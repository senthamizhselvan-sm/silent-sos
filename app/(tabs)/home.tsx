import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const [data, setData] = useState<AccelerometerMeasurement>({
    x: 0,
    y: 0,
    z: 0,
    timestamp: Date.now(),
  });
  const [shakeDetected, setShakeDetected] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const subscription = Accelerometer.addListener((accelerometerData) => {
      setData(accelerometerData);
    });
    Accelerometer.setUpdateInterval(300);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const { x, y, z } = data;
    const totalForce = Math.sqrt(x * x + y * y + z * z);
    if (totalForce > 2.0 && !shakeDetected) {
      setShakeDetected(true);
      triggerSOS();
      setTimeout(() => setShakeDetected(false), 2000);
    }
  }, [data]);

  const triggerSOS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;

      const contactList = await AsyncStorage.getItem('emergency_contacts');
      if (!contactList) {
        Alert.alert('No Contacts', 'Please add emergency contacts in Settings.');
        return;
      }

      const contacts: string[] = JSON.parse(contactList);
      const message = `🚨 SOS Alert!\nI'm in danger. My location: ${mapsUrl}`;

      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync(contacts, message);
        Alert.alert('✅ SOS Sent', 'SOS sent to all emergency contacts.');
      } else {
        Alert.alert('❌ SMS Failed', 'SMS is not available on this device.');
      }

      for (const number of contacts) {
        await logToFirebase(lat, lon, number, 'shake or button');
      }
    } catch (error) {
      console.error('❌ SOS Error:', error);
      Alert.alert('Error', 'Something went wrong while sending SOS.');
    }
  };

     const features = [
  {
    icon: '🔥',
    title: 'Fire Emergency',
    route: '/FireEmergency' as const,
  },
  {
    icon: '🧒',
    title: 'Child Kidnapping',
    route: '/ChildKidnapping' as const,
  },
  {
    icon: '🚨',
    title: 'Women Harassment / Threat',
    route: '/WomenHarassment' as const,
  },
  {
  icon: '🧓',
  title: 'Elder Fall Alert',
  route: '/ElderFallSOS' as const
},
{
  icon: '🏕️',
  title: 'trekking',
  route: '/trekking' as const
},
  

];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🆘 Silent SOS</Text>
        <TouchableOpacity style={styles.sosButton} onPress={triggerSOS}>
          <Text style={styles.sosText}>SEND SOS</Text>
        </TouchableOpacity>
        <Text style={styles.subtitle}>
          Shake or Tap to trigger emergency alert
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚨 Common Emergencies</Text>
        <View style={styles.grid}>
          {features.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.featureCard}
            onPress={() => router.push(item.route)}
            >
              <Text style={styles.featureEmoji}>{item.icon}</Text>
              <Text style={styles.featureTitle}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { alignItems: 'center', padding: 20 },
  title: {
    fontSize: 32,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sosButton: {
    backgroundColor: '#ff1e1e',
    paddingVertical: 15,
    paddingHorizontal: 60,
    borderRadius: 100,
    marginBottom: 10,
  },
  sosText: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
  subtitle: { color: '#bbb', fontSize: 14 },
  section: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { color: '#fff', fontSize: 20, marginBottom: 10 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 10,
    marginVertical: 5,
  },
  featureEmoji: { fontSize: 28, marginBottom: 5 },
  featureTitle: { color: '#fff', fontSize: 14, textAlign: 'center' },
});

const logToFirebase = async (
  lat: number,
  lon: number,
  contact: string,
  method: string
): Promise<void> => {
  try {
    await addDoc(collection(db, 'sos_alerts'), {
      timestamp: new Date().toISOString(),
      latitude: lat,
      longitude: lon,
      contact,
      method,
    });
    console.log('✅ Firestore log added');
  } catch (err) {
    console.error('❌ Firebase Log Error:', err);
    Alert.alert('❌ Firestore Error', 'Failed to save log.');
  }
};
