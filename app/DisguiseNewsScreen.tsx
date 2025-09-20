import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useRouter } from 'expo-router';

const NEWS_API_KEY = '1d9c7c081c724259a7119ce1701f5515';

export default function DisguiseNewsScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [news, setNews] = useState<{ title: string, source: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // ⏳ Auto-redirect to home after 7 seconds
  useEffect(() => {
  const timeout = setTimeout(() => {
    router.replace('/home');
  }, 7000); // After 7 seconds

  return () => clearTimeout(timeout);
}, []);
  const fetchNews = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const response = await fetch(
        `https://newsapi.org/v2/top-headlines?country=us&apiKey=${NEWS_API_KEY}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      const data = await response.json();
      if (data.articles && data.articles.length > 0) {
        setNews(data.articles.map((article: any) => ({
          title: article.title,
          source: article.source.name,
        })));
      } else {
        setNews([
          { title: 'Local Community Raises Funds for Park Renovation', source: 'Local News' },
          { title: 'Weather Alert: Storm Expected This Weekend', source: 'Weather Service' },
          { title: 'New Shopping Mall to Open Downtown Next Month', source: 'Business Daily' },
          { title: 'School District Announces New Education Initiative', source: 'Education Times' },
        ]);
      }
    } catch (err) {
      console.error('News fetch error:', err);
      setError('Failed to load news. Pull down to refresh.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const triggerSOS = async () => {
    try {
      setLoading(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required for SOS');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
      const message = `🚨 I need help! My location: ${mapsUrl}`;

      const contacts = await AsyncStorage.getItem('emergency_contacts');
      if (!contacts) {
        Alert.alert('No contacts', 'Please add emergency contacts in settings');
        return;
      }

      const contactList: string[] = JSON.parse(contacts);
      const smsAvailable = await SMS.isAvailableAsync();

      if (smsAvailable) {
        await SMS.sendSMSAsync(contactList, message);
      } else {
        await Share.share({
          message,
          title: 'Emergency Alert',
        });
      }

      const alertsCollection = collection(db, 'sos_alerts');
      for (const number of contactList) {
        await addDoc(alertsCollection, {
          timestamp: new Date().toISOString(),
          latitude: lat,
          longitude: lon,
          contact: number,
          method: 'Disguise News',
          status: 'sent',
        });
      }

      router.replace('/'); // Redirect to home
    } catch (err) {
      console.error('❌ SOS Error:', err);
      Alert.alert('Error', 'Failed to send SOS. Please try again.');
    } finally {
      setLoading(false);
    }
  };
 const handleScroll = (event: any) => {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

  const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;

  if (distanceFromBottom < 50) {
    router.replace('/home'); // Navigate only when bottom reached
  }
};
  return (
   <ScrollView
  style={styles.container}
  onScroll={handleScroll}
  scrollEventThrottle={16}
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={fetchNews}
      tintColor="#fff"
    />
  }
>
      <Text style={styles.header}>📰 Daily News Digest</Text>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {news.length > 0 ? (
        news.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.card}
            onLongPress={triggerSOS}
            delayLongPress={1500}
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.source}>{item.source}</Text>
          </TouchableOpacity>
        ))
      ) : (
        <ActivityIndicator size="large" color="#fff" />
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Sending SOS...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#fff',
  },
  card: {
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  source: {
    fontSize: 12,
    color: '#BB86FC',
    fontStyle: 'italic',
  },
  loadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '30%',
    backgroundColor: '#0009',
    padding: 20,
    borderRadius: 10,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    textAlign: 'center',
  },
  errorText: {
    color: '#CF6679',
    marginBottom: 16,
    textAlign: 'center',
  },
});
