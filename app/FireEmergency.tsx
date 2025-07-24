import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import * as SMS from 'expo-sms';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

export default function FireEmergencyScreen() {
  const [sirenSound, setSirenSound] = useState<Audio.Sound | null>(null);

  // Auto-trigger emergency features on screen mount
  useEffect(() => {
    (async () => {
      await playSiren();
      await sendLocationSMS();

      Alert.alert(
        'Flashlight Notice',
        '⚠️ Flashlight feature is only available in standalone builds, not in Expo Go.'
      );
    })();

    return () => {
      if (sirenSound) {
        sirenSound.unloadAsync();
      }
    };
  }, []);

  // ✅ Siren with background audio and looping
  const playSiren = async () => {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true
    });

    const { sound } = await Audio.Sound.createAsync(
      require('../assets/siren.mp3'),
      { shouldPlay: true, isLooping: true }
    );

    setSirenSound(sound);
  } catch (error) {
    Alert.alert('Error', 'Failed to play siren.');
    console.error('Siren error:', error);
  }
};


  // ✅ Send location to all emergency contacts
  const sendLocationSMS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const url = `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;

      const stored = await AsyncStorage.getItem('emergency_contacts');
      if (!stored) {
        Alert.alert('No Contacts', 'Please add emergency contacts in Settings.');
        return;
      }

      const contacts: string[] = JSON.parse(stored);
      const message = `🔥 Fire Emergency! I need help. My location: ${url}`;

      const available = await SMS.isAvailableAsync();
      if (available) {
        await SMS.sendSMSAsync(contacts, message);
        Alert.alert('✅ Sent', 'Location sent to all emergency contacts.');
      } else {
        Alert.alert('❌ Failed', 'SMS is not available on this device.');
      }
    } catch (err) {
      console.error('SMS Error:', err);
      Alert.alert('Error', 'Failed to send SMS.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔥 Fire Emergency</Text>
      <Text style={styles.description}>Emergency actions triggered automatically.</Text>

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
});
