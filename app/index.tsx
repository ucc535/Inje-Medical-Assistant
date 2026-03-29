import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // 💡 AsyncStorage 추가
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function IntroScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. 페이드 인 애니메이션 시작
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start();

    // 2. 유저 데이터 확인 후 화면 전환 로직
    const checkUserAndNavigate = async () => {
      try {
        // 저장된 이름이 있는지 확인
        const userName = await AsyncStorage.getItem('user_name');

        // 3초 뒤에 결과에 따라 이동
        setTimeout(() => {
          if (userName) {
            // 이름이 있으면 바로 메인 탭으로
            router.replace('/(tabs)');
          } else {
            // 이름이 없으면 초기 설정 화면으로
            router.replace('/setup');
          }
        }, 3000);
      } catch (e) {
        console.error("데이터 로딩 실패:", e);
        // 오류 시 안전하게 설정 화면으로
        router.replace('/setup');
      }
    };

    checkUserAndNavigate();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        
        {/* 상단 네이비 로고 */}
        <View style={styles.logoWrapper}>
          <Ionicons name="medical" size={80} color="#003594" />
        </View>

        {/* 학교 및 앱 이름 */}
        <Text style={styles.univText}>INJE UNIVERSITY</Text>
        <Text style={styles.collegeText}>College of Medicine</Text>
        <View style={styles.divider} />
        <Text style={styles.appName}>SMART ASSISTANT</Text>

        {/* 로딩 아이콘 영역 */}
        <View style={styles.loaderWrapper}>
          <ActivityIndicator 
            size="large" 
            color="#4A90E2" 
          />
          <Text style={styles.loaderText}>Initializing Clinical Environment...</Text>
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', width: '100%' },
  logoWrapper: { marginBottom: 20 },
  univText: { fontSize: 16, color: '#003594', letterSpacing: 3, fontWeight: '600' },
  collegeText: { fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 5 },
  divider: { width: 30, height: 2, backgroundColor: '#4A90E2', marginVertical: 20 },
  appName: { fontSize: 14, color: '#999', letterSpacing: 5 },
  
  loaderWrapper: {
    marginTop: 60,
    alignItems: 'center',
    gap: 15,
  },
  loaderText: {
    fontSize: 12,
    color: '#BBB',
    fontStyle: 'italic',
  },
});