import { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const [contact, setContact] = useState('');
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const stored = await AsyncStorage.getItem('emergency_contacts');
        if (stored) {
          setContacts(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Error loading contacts:', e);
      }
    };
    fetchContacts();
  }, []);

  const saveContact = async () => {
    if (!contact.trim()) {
      Alert.alert('⚠️ Empty Field', 'Please enter a phone number.');
      return;
    }

    const updated = [...contacts, contact];
    setContacts(updated);
    setContact('');
    try {
      await AsyncStorage.setItem('emergency_contacts', JSON.stringify(updated));
      Alert.alert('✅ Saved', 'Contact added successfully.');
    } catch (e) {
      Alert.alert('❌ Failed', 'Could not save contact.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📞 Emergency Contacts</Text>

      <TextInput
        style={styles.input}
        keyboardType="phone-pad"
        placeholder="Enter contact number"
        value={contact}
        onChangeText={setContact}
      />

      <Button title="Add Contact" onPress={saveContact} />

      <Text style={styles.listTitle}>Saved Contacts:</Text>
      <FlatList
        data={contacts}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => <Text style={styles.contactItem}>• {item}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, padding: 20, backgroundColor: '#000'
  },
  title: {
    fontSize: 22, color: '#fff', marginBottom: 20
  },
  input: {
    backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 15
  },
  listTitle: {
    color: '#fff', marginTop: 20, fontSize: 18
  },
  contactItem: {
    color: '#ccc', fontSize: 16, marginTop: 5
  }
});
