import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// 💡 분리한 튜토리얼 모달 임포트
import TutorialModal from '../../components/TutorialModal';

const db = SQLite.openDatabaseSync('medical_assistant_v2.db');

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false } as any; 
  },
});

const CATEGORY_LABELS: any = { exam: '시험', practice: '실습', personal: '개인/기타' };

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [userName, setUserName] = useState('사용자');
  const [todaySchedules, setTodaySchedules] = useState<any[]>([]); 
  const [weather, setWeather] = useState({ isRainingNow: false, isRainExpectedAfternoon: false });
  const [isWarningDismissed, setIsWarningDismissed] = useState(false);
  const [urgentTask, setUrgentTask] = useState<string | null>(null);

  // 💡 튜토리얼 상태 추가
  const [isTutorialVisible, setTutorialVisible] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadUserData();
      checkUrgentTasks();
      checkFirstLaunch(); // 💡 화면에 들어올 때마다 최초 실행인지 검사
    }
  }, [isFocused]);

  // 💡 [핵심 추가] 최초 1회 실행 감지 로직
  const checkFirstLaunch = async () => {
    try {
      const hasSeenTutorial = await AsyncStorage.getItem('has_seen_tutorial');
      
      // 저장된 기록이 없다면 (초기 세팅 후 처음 홈화면에 온 것)
      if (!hasSeenTutorial) {
        setTutorialVisible(true); // 튜토리얼을 띄움
        await AsyncStorage.setItem('has_seen_tutorial', 'true'); // 봤다는 도장을 찍음
      }
    } catch (error) {
      console.log('최초 실행 확인 에러:', error);
    }
  };

  const getCoordinates = (locationName: string) => {
    if (!locationName) return { lat: 37.6482, lon: 127.0606 }; 
    if (locationName.includes('해운대')) return { lat: 35.1735, lon: 129.1818 };
    if (locationName.includes('부산')) return { lat: 35.1438, lon: 129.0186 };
    if (locationName.includes('일산')) return { lat: 37.6688, lon: 126.7516 };
    return { lat: 37.6482, lon: 127.0606 }; 
  };

  const fetchWeather = async (locationStr: string) => {
    try {
      const coords = getCoordinates(locationStr);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=precipitation&hourly=precipitation_probability&timezone=Asia/Seoul`;
      const response = await fetch(url);
      const data = await response.json();
      setWeather({ 
        isRainingNow: data.current.precipitation > 0, 
        isRainExpectedAfternoon: data.hourly.precipitation_probability.slice(new Date().getHours(), 24).some((p: number) => p >= 30) 
      });
    } catch (e) {}
  };

  const loadUserData = async () => {
    try {
      const savedName = await AsyncStorage.getItem('user_name');
      if (savedName) setUserName(savedName);
      
      const rotation = db.getFirstSync<any>("SELECT hospital FROM rotations WHERE date = ?", [todayStr]);
      const results = db.getAllSync<any>("SELECT * FROM schedules WHERE date = ?", [todayStr]);
      setTodaySchedules(results || []);

      let targetLocation = rotation?.hospital || (results.length > 0 ? results[0].location : '상계');
      fetchWeather(targetLocation);
    } catch (e) { console.error(e); }
  };

  const checkUrgentTasks = () => {
    const nowTs = new Date().getTime();
    const tasks = db.getAllSync<any>("SELECT title, deadlineTimestamp FROM portfolio_tasks WHERE completed = 0 AND deadlineTimestamp IS NOT NULL");
    let foundUrgent: string | null = null;
    tasks.forEach((t: any) => {
      const diffHours = (t.deadlineTimestamp - nowTs) / 3600000;
      if (diffHours > 0 && diffHours <= 2) foundUrgent = `${t.title} (마감 임박!)`;
    });
    setUrgentTask(foundUrgent);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {urgentTask && (
          <TouchableOpacity style={styles.urgentBanner} onPress={() => router.push('/checklist' as any)}>
            <Ionicons name="alert-circle" size={24} color="#FFF" />
            <View style={{ flex: 1 }}><Text style={styles.urgentText}>마감 임박 과제 발견!</Text><Text style={styles.urgentSub}>{urgentTask}</Text></View>
            <Ionicons name="chevron-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        )}

        <View style={styles.headerSection}>
          <View style={styles.greetingRow}>
            <Text style={styles.greetingText}>안녕하세요 {userName}님!</Text>
            <View style={styles.headerIconsRow}>
              {/* 💡 기존처럼 아이콘을 누르면 언제든지 다시 볼 수 있음 */}
              <TouchableOpacity onPress={() => setTutorialVisible(true)} style={styles.iconBtn}>
                <Ionicons name="help-circle-outline" size={26} color="#003594" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/settings')} style={styles.iconBtn}>
                <Ionicons name="settings-outline" size={24} color="#333" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="calendar" size={22} color="#4A90E2" />
              <Text style={styles.headerTitle}>오늘의 일정</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/meal' as any)} style={styles.miniMealBtn}>
              <Ionicons name="restaurant" size={16} color="#003594" />
            </TouchableOpacity>
          </View>

          {todaySchedules.length > 0 ? (
            todaySchedules.map((item, index) => (
              <View key={item.id} style={[styles.scheduleItemContainer, { borderLeftColor: item.color || '#4A90E2' }, index > 0 && styles.scheduleDivider]}>
                <View style={styles.categoryBadge}><Text style={[styles.categoryBadgeText, { color: item.color || '#4A90E2' }]}>{CATEGORY_LABELS[item.category] || '일반'}</Text></View>
                <Text style={styles.mainScheduleText}>{item.title}</Text>
                <Text style={styles.subText}>📍 {item.location || '장소 미지정'}</Text>
                {item.note && <View style={styles.noteBox}><Text style={styles.noteText}>{item.note}</Text></View>}
              </View>
            ))
          ) : (
            <View style={styles.emptySchedule}><Text style={styles.noScheduleText}>오늘은 등록된 일정이 없습니다.</Text></View>
          )}
        </View>

        {(weather.isRainingNow || weather.isRainExpectedAfternoon) && !isWarningDismissed && (
          <View style={styles.rainWarningBox}>
            <View style={styles.rainIconBox}><Ionicons name="umbrella" size={28} color="#fff" /></View>
            <View style={{ flex: 1 }}><Text style={styles.rainWarningTitle}>우산을 챙기세요!</Text><Text style={styles.rainWarningSub}>오늘 비 소식이 있습니다.</Text></View>
            <TouchableOpacity onPress={() => setIsWarningDismissed(true)}><Ionicons name="close" size={20} color="#BDC3C7" /></TouchableOpacity>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 💡 튜토리얼 모달 컴포넌트 호출 */}
      <TutorialModal 
        visible={isTutorialVisible} 
        onClose={() => setTutorialVisible(false)} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5F8' },
  scrollContent: { padding: 25 },
  urgentBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E74C3C', padding: 18, borderRadius: 24, marginBottom: 20, gap: 12, elevation: 8 },
  urgentText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  urgentSub: { color: '#FFDADA', fontSize: 13 },
  headerSection: { marginBottom: 35, marginTop: 70 }, 
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greetingText: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A' },
  headerIconsRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 15, elevation: 2 },
  card: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, elevation: 5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#CCC', letterSpacing: 1 },
  miniMealBtn: { padding: 8, backgroundColor: '#F2F5F8', borderRadius: 12, borderWidth: 1, borderColor: '#EBF0F5' },
  scheduleItemContainer: { paddingLeft: 16, paddingVertical: 10, borderLeftWidth: 6, borderRadius: 4, marginBottom: 5 },
  scheduleDivider: { marginTop: 15, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#F2F5F8' },
  categoryBadge: { marginBottom: 6 },
  categoryBadgeText: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  mainScheduleText: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 6 },
  subText: { fontSize: 15, color: '#666', fontWeight: '500', marginBottom: 12 },
  noteBox: { backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#E1E8EE' },
  noteText: { fontSize: 14, color: '#777', lineHeight: 20 },
  emptySchedule: { alignItems: 'center', paddingVertical: 20 },
  noScheduleText: { color: '#CCC', fontSize: 15 },
  rainWarningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#34495E', padding: 20, borderRadius: 24, marginTop: 20, gap: 15 },
  rainIconBox: { backgroundColor: '#4A90E2', padding: 12, borderRadius: 16 },
  rainWarningTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  rainWarningSub: { color: '#BDC3C7', fontSize: 14 },
});