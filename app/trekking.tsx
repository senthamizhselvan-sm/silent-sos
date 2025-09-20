import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Vibration,
  Share,
  Linking,
  Platform,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { Magnetometer } from 'expo-sensors';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons, FontAwesome, Entypo } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';

const STATIONARY_THRESHOLD_MINUTES = 30;

// Default checklist items
const DEFAULT_CHECKLIST_ITEMS = [
  { id: '1', text: 'Emergency Contact Added', completed: false },
  { id: '2', text: 'Route Plan Ready', completed: false },
  { id: '3', text: 'Return Time Set', completed: false },
  { id: '4', text: 'Water Bottle Packed', completed: false },
  { id: '5', text: 'Phone Fully Charged', completed: false },
];

export default function TrekkingSafetyScreen() {
  // State variables
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [signalLogs, setSignalLogs] = useState<{time: string, strength: number | null, type: string}[]>([]);
  const [heading, setHeading] = useState(0);
  const [beaconActive, setBeaconActive] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [lastMovementTime, setLastMovementTime] = useState<Date | null>(null);
  const [sosTapSequence, setSosTapSequence] = useState<number[]>([]);
  const [checklistItems, setChecklistItems] = useState(DEFAULT_CHECKLIST_ITEMS);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [signalDetails, setSignalDetails] = useState<{type: string, strength: number | null, generation: string | null} | null>(null);

  // Refs
 const beaconInterval = useRef<NodeJS.Timeout | number | null>(null);
const signalLogger = useRef<NodeJS.Timeout | number | null>(null);
const stationaryTimer = useRef<NodeJS.Timeout | number | null>(null);
  const magnetometerSubscription = useRef<any>(null);
  const mapRef = useRef<MapView>(null);

  // Initialize features
  useEffect(() => {
    getLocation();
    startSignalLogger();
    startCompass();
    startMovementMonitor();
    loadChecklist();

    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
  if (beaconInterval.current) {
    clearInterval(beaconInterval.current as NodeJS.Timeout);
    beaconInterval.current = null;
  }
  if (signalLogger.current) {
    clearInterval(signalLogger.current as NodeJS.Timeout);
    signalLogger.current = null;
  }
  if (stationaryTimer.current) {
    clearInterval(stationaryTimer.current as NodeJS.Timeout);
    stationaryTimer.current = null;
  }
  if (magnetometerSubscription.current) {
    magnetometerSubscription.current.remove();
    magnetometerSubscription.current = null;
  }
};
  // Location functions
  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      setLocation(location);
      
      // Center map on location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  // Signal strength logger
  const startSignalLogger = () => {
    // First immediate check
    checkSignalStrength();
    
    // Then set up interval
    signalLogger.current = setInterval(() => {
      checkSignalStrength();
    }, 300000); // Every 5 minutes
  };

  const checkSignalStrength = async () => {
    try {
      const state = await NetInfo.fetch();
      
      let strength: number | null = null;
      let generation: string | null = null;
      
      if (state.type === 'cellular' && state.details) {
        const cellularDetails = state.details as any;
        strength = cellularDetails.cellularStrength || null;
        generation = cellularDetails.cellularGeneration || null;
      } else if (state.type === 'wifi' && state.details) {
        const wifiDetails = state.details as any;
        strength = wifiDetails.strength || null;
      }
      
      setSignalDetails({
        type: state.type,
        strength,
        generation
      });
      
      setSignalLogs(prev => [
        ...prev.slice(-4), // Keep only last 5 logs
        {
          time: new Date().toLocaleTimeString(),
          strength,
          type: state.type
        },
      ]);
    } catch (error) {
      console.error('Signal check error:', error);
    }
  };

  // Compass functions
  const startCompass = () => {
    Magnetometer.setUpdateInterval(100);
    magnetometerSubscription.current = Magnetometer.addListener((data) => {
      const { x, y } = data;
      let heading = Math.atan2(y, x) * (180 / Math.PI);
      if (heading < 0) heading += 360;
      setHeading(Math.round(heading));
    });
  };

  // Rescue beacon functions
  const toggleBeacon = () => {
    if (beaconActive) {
      if (beaconInterval.current) clearInterval(beaconInterval.current);
      setBeaconActive(false);
      Vibration.cancel();
    } else {
      setBeaconActive(true);
    beaconInterval.current = setInterval(() => {
  Vibration.vibrate([500, 500, 500, 500, 500, 500], true);
}, 3000) as unknown as NodeJS.Timeout;
    }
  };

  // Movement monitoring
  const startMovementMonitor = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 60000,
        distanceInterval: 10,
      },
      (location) => {
        setLastMovementTime(new Date());
        setLocation(location);
      }
    );
    
   stationaryTimer.current = setInterval(() => {
  if (!lastMovementTime) return;
  
  const minutesStationary = (new Date().getTime() - lastMovementTime.getTime()) / 60000;
  if (minutesStationary > STATIONARY_THRESHOLD_MINUTES) {
    Alert.alert(
      'Stationary Alert',
      'You haven\'t moved in 30 minutes. Are you okay?',
      [
        {
          text: 'I\'m okay',
          onPress: () => setLastMovementTime(new Date()),
        },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: sendSOS,
        },
      ]
    );
  }
}, 60000) as unknown as NodeJS.Timeout;
  };

  // Checklist functions
  const loadChecklist = async () => {
    try {
      const stored = await AsyncStorage.getItem('trekking_checklist_v3');
      if (stored) {
        setChecklistItems(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Checklist load error:', err);
    }
  };

  const saveChecklist = async (items: typeof checklistItems) => {
    try {
      await AsyncStorage.setItem('trekking_checklist_v3', JSON.stringify(items));
      setChecklistItems(items);
    } catch (err) {
      console.error('Checklist save error:', err);
    }
  };

  const toggleChecklistItem = (id: string) => {
    const updatedItems = checklistItems.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    saveChecklist(updatedItems);
  };

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    
    const newItem = {
      id: Date.now().toString(),
      text: newChecklistItem.trim(),
      completed: false
    };
    
    const updatedItems = [...checklistItems, newItem];
    saveChecklist(updatedItems);
    setNewChecklistItem('');
  };

  const removeChecklistItem = (id: string) => {
    const updatedItems = checklistItems.filter(item => item.id !== id);
    saveChecklist(updatedItems);
  };

  // Voice memo functions
  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Failed to start voice recording.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      const uri = recording.getURI();
      if (uri) {
        Alert.alert('Recording Saved', `Memo saved at: ${uri}`);
      }
      
      setRecording(null);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      Alert.alert('Error', 'Failed to save voice recording.');
    }
  };

  // SOS functions
  const handleMorseTap = () => {
    const now = Date.now();
    setSosTapSequence(prev => [...prev, now].slice(-9));
    
    if (sosTapSequence.length >= 8) {
      const diffs = [];
      for (let i = 1; i < sosTapSequence.length; i++) {
        diffs.push(sosTapSequence[i] - sosTapSequence[i - 1]);
      }
      
      const isSOS =
        diffs[0] < 500 && diffs[1] < 500 && diffs[2] < 500 &&
        diffs[3] > 1000 && diffs[4] > 1000 && diffs[5] > 1000 &&
        diffs[6] < 500 && diffs[7] < 500 && diffs[8] < 500;
      
      if (isSOS) {
        sendSOS();
        setSosTapSequence([]);
      }
    }
  };

  const sendSOS = async () => {
    try {
      let locationInfo = '';
      if (location) {
        locationInfo = `My location: https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
      }
      
      const message = `🚨 SOS! I need help while trekking. ${locationInfo}`;
      
      if (Platform.OS === 'android') {
        Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
      } else {
        const result = await Share.share({
          message,
          title: 'SOS Alert',
        });
        
        if (result.action === Share.sharedAction) {
          Alert.alert('SOS Sent', 'Your emergency message was shared successfully.');
        }
      }
    } catch (err) {
      console.error('SOS Error:', err);
      Alert.alert('Error', 'Failed to send SOS message.');
    }
  };

  const getCardinalDirection = (deg: number): string => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
    const index = Math.round(deg / 45);
    return directions[index];
  };

  const getSignalStrengthText = (strength: number | null, type: string) => {
    if (strength === null) return 'Unknown';
    
    if (type === 'wifi') {
      if (strength > -50) return 'Excellent';
      if (strength > -60) return 'Good';
      if (strength > -70) return 'Fair';
      return 'Weak';
    } else { // cellular
      if (strength > -75) return 'Excellent';
      if (strength > -85) return 'Good';
      if (strength > -95) return 'Fair';
      return 'Weak';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>⛰️ Trekking Safety</Text>
      
      {/* Location Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧭 Current Location</Text>
        {location ? (
          <>
            <Text style={styles.sectionText}>
              {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)}
            </Text>
            <Text style={styles.sectionText}>
              Accuracy: {location.coords.accuracy?.toFixed(1) || 'Unknown'} meters
            </Text>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => setShowMap(true)}
            >
              <Text style={styles.buttonText}>View on Map</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.sectionText}>Location not available</Text>
        )}
        <TouchableOpacity style={styles.smallButton} onPress={getLocation}>
          <Text style={styles.buttonText}>Refresh Location</Text>
        </TouchableOpacity>
      </View>
      
      {/* Signal Logger */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📶 Signal Strength</Text>
        {signalDetails && (
          <Text style={styles.sectionText}>
            Current: {signalDetails.type.toUpperCase()} {signalDetails.generation || ''} -{' '}
            {signalDetails.strength !== null 
              ? `${getSignalStrengthText(signalDetails.strength, signalDetails.type)} (${signalDetails.strength} dBm)`
              : 'Unknown'}
          </Text>
        )}
        {signalLogs.length > 0 ? (
          signalLogs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log.time}: {log.type} - {log.strength !== null 
                ? `${getSignalStrengthText(log.strength, log.type)} (${log.strength} dBm)`
                : 'Unknown'}
            </Text>
          ))
        ) : (
          <Text style={styles.sectionText}>Monitoring signal...</Text>
        )}
        <TouchableOpacity 
          style={styles.smallButton} 
          onPress={checkSignalStrength}
        >
          <Text style={styles.buttonText}>Check Signal Now</Text>
        </TouchableOpacity>
      </View>
      
      {/* Rescue Beacon */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📌 Rescue Beacon</Text>
        <Text style={styles.sectionText}>
          {beaconActive ? 'Active - Visible to rescuers' : 'Activate in emergency'}
        </Text>
        <TouchableOpacity
          style={[styles.button, beaconActive && styles.emergencyButton]}
          onPress={toggleBeacon}
        >
          <Text style={styles.buttonText}>
            {beaconActive ? 'Deactivate Beacon' : 'Activate Beacon'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Stationary Alert */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📡 Movement Monitor</Text>
        <Text style={styles.sectionText}>
          {lastMovementTime
            ? `Last movement: ${lastMovementTime.toLocaleTimeString()}`
            : 'Monitoring movement...'}
        </Text>
      </View>
      
      {/* Safety Checklist */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧠 Safety Checklist</Text>
        
        {checklistItems.map((item) => (
          <View key={item.id} style={styles.checklistItemContainer}>
            <TouchableOpacity
              style={styles.checklistItem}
              onPress={() => toggleChecklistItem(item.id)}
            >
              <Text style={[styles.sectionText, item.completed && { color: '#4CAF50' }]}>
                {item.completed ? '✅' : '❌'} {item.text}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => removeChecklistItem(item.id)}
            >
              <Entypo name="cross" size={20} color="#FF6E6E" />
            </TouchableOpacity>
          </View>
        ))}
        
        <View style={styles.addItemContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add new checklist item"
            value={newChecklistItem}
            onChangeText={setNewChecklistItem}
            onSubmitEditing={addChecklistItem}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={addChecklistItem}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        
        {checklistItems.every(item => item.completed) ? (
          <Text style={{ color: '#4CAF50', marginTop: 10, fontWeight: 'bold' }}>
            ✅ All set! Ready to start trekking.
          </Text>
        ) : (
          <Text style={{ color: '#FF6E6E', marginTop: 10 }}>
            ❗Complete all checklist items before you go.
          </Text>
        )}
      </View>
      
      {/* Morse Code SOS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📌 Secret SOS Tap</Text>
        <Text style={styles.sectionText}>Tap 3 fast, 3 slow, 3 fast to send SOS</Text>
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={handleMorseTap}
        >
          <Text style={styles.buttonText}>Tap Here for SOS</Text>
        </TouchableOpacity>
      </View>
      
      {/* Compass */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧭 Compass</Text>
        <View style={styles.compassWrapper}>
          <View style={styles.enhancedCompass}>
            <Text style={styles.degreeText}>{heading}°</Text>
            <Text style={styles.directionText}>{getCardinalDirection(heading)}</Text>
          </View>
        </View>
      </View>

      {/* Voice Memo */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎙 Voice Memo</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.smallButton, recording && styles.recordingButton]}
            onPress={recording ? stopRecording : startRecording}
          >
            <Text style={styles.buttonText}>
              {recording ? (
                <>
                  <FontAwesome name="stop" size={16} color="white" /> Stop
                </>
              ) : (
                <>
                  <FontAwesome name="microphone" size={16} color="white" /> Record
                </>
              )}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Emergency SOS Button */}
      <TouchableOpacity
        style={[styles.button, styles.sosButton]}
        onPress={sendSOS}
      >
        <Text style={styles.sosButtonText}>
          <MaterialIcons name="emergency" size={20} color="white" /> SEND SOS
        </Text>
      </TouchableOpacity>
      
      {/* Map Modal */}
      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}
      >
        <View style={styles.modalContainer}>
          {location && (
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }}
            >
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                title="Your Location"
              />
            </MapView>
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowMap(false)}
          >
            <Text style={styles.closeButtonText}>Close Map</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#BB86FC',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#E0E0E0',
    marginBottom: 8,
  },
  logText: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#3700B3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  smallButton: {
    backgroundColor: '#3700B3',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  emergencyButton: {
    backgroundColor: '#B00020',
  },
  recordingButton: {
    backgroundColor: '#B00020',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  checklistItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  checklistItem: {
    flex: 1,
  },
  deleteButton: {
    padding: 8,
  },
  addItemContainer: {
    flexDirection: 'row',
    marginTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#2D2D2D',
    color: '#E0E0E0',
    padding: 10,
    borderRadius: 6,
    marginRight: 8,
  },
  addButton: {
    backgroundColor: '#3700B3',
    width: 40,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  compassWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  enhancedCompass: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    borderColor: '#BB86FC',
    backgroundColor: '#1F1B24',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#BB86FC',
    shadowOpacity: 0.7,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
  },
  degreeText: {
    fontSize: 24,
    color: '#FFF',
    fontWeight: 'bold',
  },
  directionText: {
    fontSize: 20,
    color: '#4CAF50',
    marginTop: 8,
  },
  sosButton: {
    backgroundColor: '#B00020',
    marginTop: 20,
    marginBottom: 40,
  },
  sosButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  map: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#3700B3',
    padding: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});