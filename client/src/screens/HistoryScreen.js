import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { userInjuryHistoryApi } from '../api/userInjuryHistoryApi';
import { AuthContext } from '../context/AuthContext';

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const { user } = useContext(AuthContext);
  const userId = user?.id;

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await userInjuryHistoryApi.getUserInjuryHistory(userId);
        setHistory(Array.isArray(data) ? data : []); // ensure array
      } catch (error) {
        console.error("Failed to fetch injury history:", error);
      }
    }

    if (userId) fetchHistory();
  }, [userId]);

  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.item}>{item.injury}</Text>
      <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>

      {history.length > 0 ? (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <Text style={styles.subtitle}>No history available.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 40 },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: 'gray',
    textAlign: 'center',
    marginTop: 50,
  },
  itemContainer: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },
  item: {
    fontSize: 16,
    color: '#333',
  },
  date: {
    fontSize: 12,
    color: 'gray',
  },
});
