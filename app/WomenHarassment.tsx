import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import * as SMS from 'expo-sms';
import { addDoc, collection } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    Alert,
    AppState,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { db } from '../firebaseConfig';

let tapCount = 0;
let tapTimer: ReturnType<typeof setTimeout>;

export default function WomenHarassmentScreen() {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      stopSiren();
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: string) => {
    if (nextAppState === "background" && sound) {
      sound.unloadAsync();
    }
  };

  const triggerSiren = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/siren.mp3'),
        { shouldPlay: true, isLooping: true }
      );
      setSound(sound);
      setIsPlaying(true);
      await sound.playAsync();
    } catch (err) {
      console.error('Siren Error:', err);
    }
  };

  const stopSiren = async () => {
  try {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    }
  } catch (err) {
    console.error('Stop Sound Error:', err);
  }
};

 const triggerFakeCall = async () => {
  setTimeout(async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/ringtone.mp3'), // your fake call sound
        { shouldPlay: true, isLooping: false }
      );
      setSound(sound);
      setIsPlaying(true);
      await sound.playAsync();
      Alert.alert('📞 Fake Call', 'Incoming call simulation started!');
    } catch (error) {
      console.error('Fake Call Error:', error);
      Alert.alert('Error', 'Could not play fake call sound.');
    }
  }, 10000); // delay for realism
};
  const sendLocationSMS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const message = `🚨 I'm in danger. My location: https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;

      const stored = await AsyncStorage.getItem('emergency_contacts');
      const contacts = stored ? JSON.parse(stored) : [];
      if (contacts.length === 0) {
        Alert.alert('No emergency contacts found');
        return;
      }

      const available = await SMS.isAvailableAsync();
      if (available) {
        await SMS.sendSMSAsync(contacts, message);
      }

      for (const contact of contacts) {
        await logToFirebase(location.coords.latitude, location.coords.longitude, contact, 'women_harassment');
      }
    } catch (err) {
      console.error('SMS Error:', err);
    }
  };

  const handleTripleTap = () => {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      tapCount = 0;
    }, 1000);

    if (tapCount >= 3) {
      Alert.alert('🚨 SOS Triggered');
      triggerSiren();
      sendLocationSMS();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚨 Women Harassment Alert</Text>
      <Text style={styles.message}>
        Triple tap the bottom red area to trigger discreet SOS.
      </Text>

     

      {/* Stop Siren Button */}
      {isPlaying && (
        <TouchableOpacity style={styles.stopButton} onPress={stopSiren}>
          <Text style={styles.stopText}>⛔ Stop Siren</Text>
        </TouchableOpacity>
      )}

      {/* Fake Call Button */}
      <TouchableOpacity style={styles.fakeCallBtn} onPress={triggerFakeCall}>
        <Text style={styles.fakeCallText}>📞 Trigger Fake Call (after 10s)</Text>
      </TouchableOpacity>

      {/* Back Navigation */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={{ color: 'white' }}>⬅️ Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 20 },
  title: { fontSize: 22, color: '#FF4444', fontWeight: 'bold', marginBottom: 10 },
  message: { color: '#ccc', marginBottom: 10 },
  tapButton: {
    height: '50%',
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  tapText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  stopButton: {
    backgroundColor: '#222',
    padding: 12,
    marginTop: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopText: {
    color: '#fff',
    fontSize: 18,
  },
  fakeCallBtn: {
    marginTop: 20,
    backgroundColor: '#333',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  fakeCallText: {
    color: '#fff',
    fontSize: 16,
  },
  backBtn: {
    marginTop: 30,
    alignItems: 'center',
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
