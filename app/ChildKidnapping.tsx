import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Linking,
  TouchableOpacity,
} from 'react-native';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function ChildKidnappingScreen() {
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    (async () => {
      const audioStatus = await Audio.requestPermissionsAsync();
      const locationStatus = await Location.requestForegroundPermissionsAsync();

      setHasAudioPermission(audioStatus.status === 'granted');

      if (locationStatus.status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed.');
        return;
      }

      await startAudioRecording();
      await sendLocationSMS();
      await makeEmergencyCall();
    })();

    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const startAudioRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: 2, // MPEG_4
          audioEncoder: 3, // AAC
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.caf',
          audioQuality: 127, // High
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);

      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (isRecording) stopRecording();
      }, 30000);
    } catch (error) {
      console.error('Audio Record Error:', error);
      Alert.alert('Error', 'Could not start audio recording.');
    }
  };

  const stopRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setAudioUri(uri || null);
        console.log('🎤 Audio saved at:', uri);
        setIsRecording(false);
        setRecording(null);
      }
    } catch (error) {
      console.error('Stop Recording Error:', error);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const playRecording = async () => {
    if (!audioUri) {
      Alert.alert('No Recording', 'Audio file not available.');
      return;
    }

    try {
      const { sound: playbackObject } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );
      setSound(playbackObject);
    } catch (error) {
      console.error('Playback Error:', error);
      Alert.alert('Error', 'Failed to play audio.');
    }
  };

  const stopAudio = async () => {
    try {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }
    } catch (error) {
      console.error('Stop Audio Error:', error);
    }
  };

  const sendLocationSMS = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
      const message = `🚨 Suspected Child Kidnapping! Location: ${mapsUrl}`;

      const stored = await AsyncStorage.getItem('emergency_contacts');
      if (!stored) {
        Alert.alert('No Contacts', 'Please add emergency contacts.');
        return;
      }

      const contacts: string[] = JSON.parse(stored);
      const available = await SMS.isAvailableAsync();

      if (available) {
        await SMS.sendSMSAsync(contacts, message);
      }

      for (const number of contacts) {
        await logToFirebase(lat, lon, number, 'child_kidnapping');
      }
    } catch (err) {
      console.error('Location SMS Error:', err);
    }
  };

  const makeEmergencyCall = async () => {
    const number = '6380960629'; // India emergency number
    try {
      const url = `tel:${number}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Call Failed', 'Could not initiate call.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👶 Child Kidnapping Alert</Text>
      <Text style={styles.message}>
        Emergency actions (audio, location, call) triggered automatically.
      </Text>

      {isRecording && (
        <>
          <Text style={styles.recordingStatus}>🎤 Recording... Tap to stop early:</Text>
          <TouchableOpacity onPress={stopRecording} style={styles.button}>
            <Text style={styles.buttonText}>🛑 Stop Recording</Text>
          </TouchableOpacity>
        </>
      )}

      {audioUri && (
        <View style={{ marginTop: 20 }}>
          <TouchableOpacity onPress={playRecording} style={styles.button}>
            <Text style={styles.buttonText}>▶️ Play Recording</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={stopAudio} style={styles.button}>
            <Text style={styles.buttonText}>⏹️ Stop Playback</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  title: { fontSize: 24, color: '#ff4444', fontWeight: 'bold', marginBottom: 10 },
  message: { color: '#ccc', marginBottom: 20 },
  recordingStatus: {
    color: '#FFA500',
    fontSize: 16,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#444',
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});

const logToFirebase = async (
  lat: number,
  lon: number,
  contact: string,
  method: string
) => {
  try {
    await addDoc(collection(db, 'sos_alerts'), {
      timestamp: new Date().toISOString(),
      latitude: lat,
      longitude: lon,
      contact,
      method,
    });
  } catch (err) {
    console.error('Firebase Log Error:', err);
  }
};
