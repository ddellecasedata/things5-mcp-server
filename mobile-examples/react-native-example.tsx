/**
 * React Native - Things5 MCP Integration
 * Esempio completo pronto all'uso
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Switch, Button, Alert, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OpenAI from 'openai';

// Configurazione
interface Things5Config {
  enabled: boolean;
  serverUrl: string;
  username: string;
  password: string;
}

const DEFAULT_CONFIG: Things5Config = {
  enabled: false,
  serverUrl: 'https://things5-mcp-server.onrender.com/sse',
  username: '',
  password: ''
};

// Componente Settings
export const Things5Settings: React.FC = () => {
  const [config, setConfig] = useState<Things5Config>(DEFAULT_CONFIG);
  const [testing, setTesting] = useState(false);

  // Carica configurazione salvata
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const saved = await AsyncStorage.getItem('things5_config');
      if (saved) {
        setConfig(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const saveConfig = async (newConfig: Things5Config) => {
    try {
      await AsyncStorage.setItem('things5_config', JSON.stringify(newConfig));
      setConfig(newConfig);
    } catch (error) {
      console.error('Error saving config:', error);
      Alert.alert('Errore', 'Impossibile salvare la configurazione');
    }
  };

  const testConnection = async () => {
    if (!config.username || !config.password) {
      Alert.alert('Errore', 'Inserisci username e password');
      return;
    }

    setTesting(true);
    try {
      // Test rapido con OpenAI
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
      });

      const mcpTool = {
        type: 'mcp' as const,
        server_label: 'things5',
        server_description: 'Things5 IoT platform',
        server_url: `${config.serverUrl}?username=${encodeURIComponent(config.username)}&password=${encodeURIComponent(config.password)}`,
        require_approval: 'never' as const
      };

      const response = await openai.responses.create({
        model: 'gpt-4o',
        tools: [mcpTool],
        input: 'Hello, test connection to Things5'
      });

      Alert.alert('✅ Successo', 'Connessione Things5 funzionante!');
    } catch (error) {
      console.error('Test failed:', error);
      Alert.alert('❌ Errore', 'Connessione fallita. Verifica le credenziali.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Integrazione Things5 IoT</Text>
      
      <View style={styles.row}>
        <Text style={styles.label}>Abilita Things5</Text>
        <Switch
          value={config.enabled}
          onValueChange={(enabled) => saveConfig({ ...config, enabled })}
        />
      </View>

      {config.enabled && (
        <>
          <Text style={styles.label}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={config.serverUrl}
            onChangeText={(serverUrl) => setConfig({ ...config, serverUrl })}
            placeholder="https://things5-mcp-server.onrender.com/sse"
          />

          <Text style={styles.label}>Username Things5</Text>
          <TextInput
            style={styles.input}
            value={config.username}
            onChangeText={(username) => setConfig({ ...config, username })}
            placeholder="your-email@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={config.password}
            onChangeText={(password) => setConfig({ ...config, password })}
            placeholder="Your password"
            secureTextEntry
          />

          <Button
            title={testing ? "Testing..." : "Test Connection"}
            onPress={testConnection}
            disabled={testing}
          />

          <Button
            title="Save Configuration"
            onPress={() => saveConfig(config)}
          />
        </>
      )}
    </View>
  );
};

// Servizio Chat con Things5
export class Things5ChatService {
  private openai: OpenAI;
  private config: Things5Config;

  constructor(apiKey: string, config: Things5Config) {
    this.openai = new OpenAI({ apiKey });
    this.config = config;
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.config.enabled) {
      return "Things5 integration is disabled. Enable it in settings.";
    }

    if (!this.config.username || !this.config.password) {
      return "Please configure Things5 credentials in settings.";
    }

    try {
      const mcpTool = {
        type: 'mcp' as const,
        server_label: 'things5',
        server_description: 'Things5 IoT platform for device management and monitoring',
        server_url: `${this.config.serverUrl}?username=${encodeURIComponent(this.config.username)}&password=${encodeURIComponent(this.config.password)}`,
        require_approval: 'never' as const
      };

      const response = await this.openai.responses.create({
        model: 'gpt-4o',
        tools: [mcpTool],
        input: message
      });

      return response.output_text || 'No response received';
    } catch (error) {
      console.error('Chat error:', error);
      
      if (error.message.includes('authentication') || error.message.includes('401')) {
        return "❌ Authentication failed. Please check your Things5 credentials in settings.";
      }
      
      return `❌ Error: ${error.message}`;
    }
  }
}

// Componente Chat
export const ChatScreen: React.FC = () => {
  const [config, setConfig] = useState<Things5Config>(DEFAULT_CONFIG);
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const saved = await AsyncStorage.getItem('things5_config');
      if (saved) {
        setConfig(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);
    try {
      const chatService = new Things5ChatService(
        process.env.OPENAI_API_KEY || 'your-api-key-here',
        config
      );

      const result = await chatService.sendMessage(message);
      setResponse(result);
    } catch (error) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat with Things5 IoT</Text>
      
      <TextInput
        style={[styles.input, styles.messageInput]}
        value={message}
        onChangeText={setMessage}
        placeholder="Ask about your IoT devices..."
        multiline
      />

      <Button
        title={loading ? "Sending..." : "Send"}
        onPress={sendMessage}
        disabled={loading || !message.trim()}
      />

      {response ? (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>Response:</Text>
          <Text style={styles.responseText}>{response}</Text>
        </View>
      ) : null}

      {/* Esempi di domande */}
      <View style={styles.examplesContainer}>
        <Text style={styles.examplesTitle}>Try asking:</Text>
        {[
          "Show me all my IoT devices",
          "What are the recent events?",
          "Are there any alarms?",
          "Give me a status overview"
        ].map((example, index) => (
          <Button
            key={index}
            title={example}
            onPress={() => setMessage(example)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  messageInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  responseContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  responseLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  responseText: {
    fontSize: 14,
    lineHeight: 20,
  },
  examplesContainer: {
    marginTop: 20,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

// Hook personalizzato per gestire Things5
export const useThings5 = () => {
  const [config, setConfig] = useState<Things5Config>(DEFAULT_CONFIG);
  const [chatService, setChatService] = useState<Things5ChatService | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (config.enabled && process.env.OPENAI_API_KEY) {
      setChatService(new Things5ChatService(process.env.OPENAI_API_KEY, config));
    } else {
      setChatService(null);
    }
  }, [config]);

  const loadConfig = async () => {
    try {
      const saved = await AsyncStorage.getItem('things5_config');
      if (saved) {
        setConfig(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const updateConfig = async (newConfig: Things5Config) => {
    try {
      await AsyncStorage.setItem('things5_config', JSON.stringify(newConfig));
      setConfig(newConfig);
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  };

  return {
    config,
    updateConfig,
    chatService,
    isEnabled: config.enabled && !!chatService
  };
};

export default { Things5Settings, ChatScreen, Things5ChatService, useThings5 };
