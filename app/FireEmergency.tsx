import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity
} from 'react-native';

export default function FireEmergencyScreen() {
  const [sirenSound, setSirenSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    (async () => {
      await playSiren();
      await sendLocationSMS();

      // Optional info for Expo Go users
      Alert.alert(
        'Flashlight Notice',
        '⚠️ Flashlight is only available in standalone builds, not Expo Go.'
      );
    })();

    return () => {
      stopSiren();
    };
  }, []);

  const playSiren = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        require('../assets/siren.mp3'),
        { shouldPlay: true, isLooping: true }
      );

      setSirenSound(sound);
      setIsPlaying(true);
    } catch (error) {
      console.error('Siren Error:', error);
    }
  };

  const stopSiren = async () => {
    try {
      if (sirenSound) {
        await sirenSound.stopAsync();
        await sirenSound.unloadAsync();
        setSirenSound(null);
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Stop Siren Error:', err);
    }
  };

  const sendLocationSMS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({});
      const url = `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;

      const stored = await AsyncStorage.getItem('emergency_contacts');
      if (!stored) return;

      const contacts: string[] = JSON.parse(stored);
      const message = `🔥 Fire Emergency! I need help. My location: ${url}`;

      const available = await SMS.isAvailableAsync();
      if (available) {
        await SMS.sendSMSAsync(contacts, message);
        // 🔇 No alert popup after sending
      }
    } catch (err) {
      console.error('SMS Error:', err);
      Alert.alert('Error', 'Failed to send emergency message.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔥 Fire Emergency</Text>
      <Text style={styles.description}>
        Emergency actions triggered automatically.
      </Text>

      {isPlaying && (
        <TouchableOpacity style={styles.stopBtn} onPress={stopSiren}>
          <Text style={styles.stopText}>⛔ Stop Siren</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.adviceTitle}>🚨 Quick Advice:</Text>
      <Text style={styles.advice}>• Stay low and avoid smoke inhalation</Text>
      <Text style={styles.advice}>• Use a wet cloth to cover your nose and mouth</Text>
      <Text style={styles.advice}>• Avoid elevators, use stairs</Text>
      <Text style={styles.advice}>• Use flashlight to signal or navigate through smoke</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 20 },
  title: { fontSize: 24, color: 'orange', marginBottom: 20, fontWeight: 'bold' },
  description: { color: '#aaa', fontSize: 16, marginBottom: 20 },
  adviceTitle: { color: '#fff', fontSize: 18, marginBottom: 10 },
  advice: { color: '#ccc', marginBottom: 5 },
  stopBtn: {
    backgroundColor: '#ff4444',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  stopText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
