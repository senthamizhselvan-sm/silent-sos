import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function ElderFallSOSScreen() {
  const [lastAcceleration, setLastAcceleration] = useState({ x: 0, y: 0, z: 0 });
  const [fallDetected, setFallDetected] = useState(false);

  useEffect(() => {
    const subscription = Accelerometer.addListener(detectFall);
    Accelerometer.setUpdateInterval(300);

    return () => subscription.remove();
  }, []);

    const detectFall = (data: { x: number; y: number; z: number }) => {
  const threshold = 2.5;
  const stillnessThreshold = 0.3;

  const movement =
    Math.abs(data.x - lastAcceleration.x) +
    Math.abs(data.y - lastAcceleration.y) +
    Math.abs(data.z - lastAcceleration.z);

  setLastAcceleration(data);

  if (movement > threshold && !fallDetected) {
    console.log('🛑 Sudden movement detected, checking for fall...');
    setTimeout(() => {
      const total = Math.sqrt(
        lastAcceleration.x ** 2 +
        lastAcceleration.y ** 2 +
        lastAcceleration.z ** 2
      );

      if (total < stillnessThreshold) {
        console.log('✅ Stillness detected — triggering SOS');
        setFallDetected(true);
        triggerSilentSOS();
      }
    }, 1500);
  }
};


  const triggerSilentSOS = async () => {
    try {
      const locationStatus = await Location.requestForegroundPermissionsAsync();
      if (locationStatus.status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;

      const message = `🧓 Fall Detected at Home!\nLive Location: ${mapsUrl}`;

      const stored = await AsyncStorage.getItem('emergency_contacts');
      if (!stored) return;

      const contacts: string[] = JSON.parse(stored);
      const available = await SMS.isAvailableAsync();
      if (available) {
        await SMS.sendSMSAsync(contacts, message);
      }

      for (const contact of contacts) {
        await logToFirebase(lat, lon, contact, 'elder_fall');
      }
    } catch (error) {
      console.error('Silent SOS Error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧓 Elder Fall Detection</Text>
      <Text style={styles.subtext}>
        This screen silently detects sudden falls followed by stillness and auto-triggers SOS.
      </Text>
      <Text style={styles.status}>
        {fallDetected ? '✅ SOS Triggered' : '🟢 Monitoring...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  title: { color: '#f5c542', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  subtext: { color: '#bbb', fontSize: 16, marginBottom: 20 },
  status: { color: '#0f0', fontSize: 18 },
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
