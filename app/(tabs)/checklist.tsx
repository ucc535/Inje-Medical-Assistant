import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const db = SQLite.openDatabaseSync('medical_assistant_v2.db');

type CategoryType = 'pre' | 'daily' | 'event' | 'weekly' | 'end' | 'triggered' | 'weekly_dept';

interface Task {
  id: number;
  title: string;
  category: CategoryType;
  deadlineInfo: string;
  requiredCount: number;
  currentCount: number;
  completed: number;
  isCustom: number;
  deadlineTimestamp: number | null;
}

export default function ChecklistScreen() {
  const isFocused = useIsFocused();
  const [tasks, setTasks] = useState<{ [key in CategoryType]: Task[] }>({ 
    pre: [], daily: [], event: [], weekly: [], end: [], triggered: [], weekly_dept: [] 
  });
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedCat, setSelectedCat] = useState<CategoryType>('daily');
  
  const [activeTab, setActiveTab] = useState<'weekly' | 'rotation'>('weekly');
  const [currentDept, setCurrentDept] = useState('과 선택 안됨');
  const [rotationEndDate, setRotationEndDate] = useState<number | null>(null);

  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours();

  const isDailyCrisis = hours >= 22 || hours < 2;
  const isWeeklyCrisis = (day === 0 && hours >= 22) || (day === 1 && hours < 2);

  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: '기본 알림',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    if (isFocused) {
      initAndSync();
    }
  }, [isFocused]);

  const initAndSync = () => {
    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS rotations (date TEXT PRIMARY KEY, hospital TEXT, dept TEXT, color TEXT, textColor TEXT);
        CREATE TABLE IF NOT EXISTS portfolio_tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL, category TEXT NOT NULL, deadlineInfo TEXT,
          requiredCount INTEGER DEFAULT 1, currentCount INTEGER DEFAULT 0,
          completed INTEGER DEFAULT 0, isCustom INTEGER DEFAULT 0, deadlineTimestamp INTEGER
        );
      `);
      try { db.execSync(`ALTER TABLE portfolio_tasks ADD COLUMN deadlineTimestamp INTEGER;`); } catch(e){}

      const countRes = db.getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM portfolio_tasks WHERE category != 'triggered' AND category != 'weekly_dept' AND isCustom = 0");
      if (countRes?.count === 0) {
        const initialTasks = [
          ['임상표현 계획과 자기평가', 'pre', '주말 내 완료', 1],
          ['임상술기 계획과 자기평가', 'pre', '주말 내 완료', 1],
          ['주간실습계획 수립', 'pre', '일요일 밤 마감', 1],
          ['일일실습기록 작성 및 제출', 'daily', '새벽 2시 리셋', 1],
          ['외래예진기록(최종) 제출', 'event', '실습 기간 누적', 2],
          ['수술참관기록 제출', 'event', '실습 기간 누적', 1],
          ['외래참관', 'event', '실습 기간 누적', 8],
          ['주간실습성찰 제출', 'weekly', '일요일 밤 마감', 1],
          ['SNAPPS 증례발표 기록', 'weekly', '일요일 밤 마감', 1],
          ['입원환자 POMR/증례발표', 'event', '실습 기간 누적', 1],
          ['환자안전성찰 제출', 'end', '4주차 목요일', 1],
          ['의사다움(Doctoring) 성찰지', 'end', '5주차 포럼 전', 1],
          ['360도 다면평가 (동료/전공의/교수)', 'end', '턴 종료 전', 1], 
          ['형성평가 피드백 확인', 'end', '중간 평가 후', 1],
          ['최종성찰 및 과정평가', 'end', '턴 종료 전', 1],
        ];
        db.withTransactionSync(() => {
          initialTasks.forEach(([title, cat, deadline, req]) => {
            db.runSync("INSERT INTO portfolio_tasks (title, category, deadlineInfo, requiredCount) VALUES (?, ?, ?, ?)", title, cat, deadline, req);
          });
        });
      }

      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const rot = db.getFirstSync<any>("SELECT dept FROM rotations WHERE date = ?", todayStr);
      
      if (rot) {
        setCurrentDept(rot.dept);
        const rules: any = {
          '내과': { outTotal: 24, obsTotal: 24, surTotal: 0, pomrTotal: 12, outPace: 2, obsPace: 2, surPace: 0, pomrPace: 1 },
          '내과1': { outTotal: 12, obsTotal: 12, surTotal: 0, pomrTotal: 6, outPace: 2, obsPace: 2, surPace: 0, pomrPace: 1 },
          '내과2': { outTotal: 12, obsTotal: 12, surTotal: 0, pomrTotal: 6, outPace: 2, obsPace: 2, surPace: 0, pomrPace: 1 },
          '외과': { outTotal: 4, obsTotal: 0, surTotal: 6, pomrTotal: 4, outPace: 1, obsPace: 0, surPace: 1, pomrPace: 1 },
          '산부인과': { outTotal: 6, obsTotal: 12, surTotal: 5, pomrTotal: 2, outPace: 1, obsPace: 2, surPace: 1, pomrPace: 1 },
          '소아청소년과': { outTotal: 4, obsTotal: 8, surTotal: 0, pomrTotal: 4, outPace: 1, obsPace: 2, surPace: 0, pomrPace: 1 },
          '정신건강의학과': { outTotal: 4, obsTotal: 12, surTotal: 0, pomrTotal: 4, outPace: 1, obsPace: 3, surPace: 0, pomrPace: 1 },
          '응급의학과': { outTotal: 2, obsTotal: 0, surTotal: 0, pomrTotal: 1, outPace: 1, obsPace: 0, surPace: 0, pomrPace: 1 }
        };
        const r = rules[rot.dept] || { outTotal: 2, obsTotal: 0, surTotal: 0, pomrTotal: 1, outPace: 1, obsPace: 0, surPace: 0, pomrPace: 1 };
        
        db.runSync("UPDATE portfolio_tasks SET requiredCount = ? WHERE title LIKE '%외래예진기록%' AND category = 'event'", r.outTotal);
        db.runSync("UPDATE portfolio_tasks SET requiredCount = ? WHERE title LIKE '%수술참관기록%' AND category = 'event'", r.surTotal);
        db.runSync("UPDATE portfolio_tasks SET requiredCount = ? WHERE title LIKE '%POMR%' AND category = 'event'", r.pomrTotal);
        db.runSync("UPDATE portfolio_tasks SET requiredCount = ? WHERE title LIKE '%외래참관%' AND category = 'event'", r.obsTotal);

        const ensureSpecialTask = (title: string, count: number) => {
          const exists = db.getFirstSync("SELECT id FROM portfolio_tasks WHERE title = ?", [title]);
          if (!exists) db.runSync("INSERT INTO portfolio_tasks (title, category, deadlineInfo, requiredCount) VALUES (?, 'event', '과별 필수 항목', ?)", title, count);
        };

        if (rot.dept.includes('내과')) ensureSpecialTask('ER/ICU 당직 실습 기록', 2);
        if (rot.dept === '정신건강의학과') ensureSpecialTask('정신상태검사(MSE) 기록', 4);
        if (rot.dept === '응급의학과') ensureSpecialTask('심폐소생술(CPR) 참여/관찰', 1);
        if (rot.dept === '외과') ensureSpecialTask('관찰 임상술기 (8종)', 8);

        const ensureWeeklyRows = (label: string, pace: number) => {
          const existing = db.getAllSync("SELECT * FROM portfolio_tasks WHERE category = 'weekly_dept' AND isCustom = 0 AND title LIKE ?", `%${label}%`);
          if (existing.length < pace) {
            for (let i = existing.length + 1; i <= pace; i++) {
              db.runSync("INSERT INTO portfolio_tasks (title, category, deadlineInfo, requiredCount, isCustom) VALUES (?, 'weekly_dept', '주간 권장 과제', 1, 0)", `${label} (${i}/${pace})`);
            }
          } else if (existing.length > pace) {
            db.runSync(`DELETE FROM portfolio_tasks WHERE id IN (SELECT id FROM portfolio_tasks WHERE category = 'weekly_dept' AND isCustom = 0 AND title LIKE '%${label}%' LIMIT ${existing.length - pace})`);
          }
        };

        ensureWeeklyRows('외래예진기록', r.outPace);
        ensureWeeklyRows('수술참관기록', r.surPace);
        ensureWeeklyRows('POMR', r.pomrPace);
        ensureWeeklyRows('외래참관', r.obsPace);
      }

      const endTask = db.getFirstSync<any>("SELECT deadlineTimestamp FROM portfolio_tasks WHERE category = 'end' LIMIT 1");
      if (endTask?.deadlineTimestamp) setRotationEndDate(endTask.deadlineTimestamp);
      checkAndReset();
    } catch (e) { console.error("초기화 실패:", e); }
  };

  const checkAndReset = async () => {
    try {
      const lastDailyReset = await AsyncStorage.getItem('last_daily_reset');
      const lastWeeklyReset = await AsyncStorage.getItem('last_weekly_reset');
      const nowTime = now.getTime();
      const dailyTarget = new Date(now); dailyTarget.setHours(2, 0, 0, 0); 
      if (now < dailyTarget) dailyTarget.setDate(dailyTarget.getDate() - 1);
      if (!lastDailyReset || Number(lastDailyReset) < dailyTarget.getTime()) {
        db.runSync("UPDATE portfolio_tasks SET currentCount = 0, completed = 0 WHERE category = 'daily'");
        await AsyncStorage.setItem('last_daily_reset', nowTime.toString());
      }
      let lastMonday = new Date(now);
      const currentDay = lastMonday.getDay();
      if (currentDay === 1 && now.getHours() < 2) lastMonday.setDate(lastMonday.getDate() - 7);
      else lastMonday.setDate(lastMonday.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
      lastMonday.setHours(2, 0, 0, 0);

      if (!lastWeeklyReset || Number(lastWeeklyReset) < lastMonday.getTime()) {
        db.runSync("UPDATE portfolio_tasks SET currentCount = 0, completed = 0 WHERE category = 'weekly' OR category = 'pre'");
        db.runSync("UPDATE portfolio_tasks SET currentCount = 0, completed = 0 WHERE category = 'weekly_dept'");
        db.runSync("DELETE FROM portfolio_tasks WHERE category = 'triggered' AND completed = 1");
        await AsyncStorage.setItem('last_weekly_reset', nowTime.toString());
      }
      loadTasks();
    } catch (e) { loadTasks(); }
  };

  const loadTasks = () => {
    const allRows = db.getAllSync<Task>("SELECT * FROM portfolio_tasks");
    const categorized: { [key in CategoryType]: Task[] } = { pre: [], daily: [], event: [], weekly: [], end: [], triggered: [], weekly_dept: [] };
    allRows.forEach(row => {
      let updatedRow = { ...row };
      if (row.deadlineTimestamp) {
        const diffHours = (row.deadlineTimestamp - now.getTime()) / (1000 * 60 * 60);
        if (diffHours < 0) updatedRow.deadlineInfo = "❌ 기한 초과";
        else if (diffHours <= 24) updatedRow.deadlineInfo = `🚨 오늘 밤 마감!`;
        else updatedRow.deadlineInfo = `🚨 마감 D-${Math.ceil(diffHours / 24)}일`;
      }
      if (categorized[row.category]) categorized[row.category].push(updatedRow);
    });
    setTasks(categorized);
  };

  const handleTaskPress = (task: Task) => {
    let nextCount, isDone;
    if (task.requiredCount > 1) {
      if (task.completed === 1) { nextCount = task.requiredCount - 1; isDone = 0; }
      else { nextCount = task.currentCount + 1; isDone = nextCount >= task.requiredCount ? 1 : 0; }
    } else {
      isDone = task.completed === 0 ? 1 : 0; nextCount = isDone ? 1 : 0;
    }
    db.runSync("UPDATE portfolio_tasks SET currentCount = ?, completed = ? WHERE id = ?", nextCount, isDone, task.id);
    if (task.category === 'triggered' || task.category === 'weekly_dept') {
      const diff = isDone ? 1 : -1;
      const search = task.title.includes('외래예진') ? '외래예진기록' : (task.title.includes('수술') ? '수술참관기록' : (task.title.includes('POMR') ? 'POMR' : (task.title.includes('외래참관') ? '외래참관' : null)));
      if (search) {
        const main = db.getFirstSync<Task>("SELECT * FROM portfolio_tasks WHERE category = 'event' AND title LIKE ?", `%${search}%`);
        if (main) db.runSync("UPDATE portfolio_tasks SET currentCount = ?, completed = ? WHERE id = ?", main.currentCount + diff, (main.currentCount + diff) >= main.requiredCount ? 1 : 0, main.id);
      }
    }
    loadTasks();
  };

  // 💡 [핵심 추가] 롱 프레스 핸들러: 차감 또는 삭제 확인
  const handleLongPress = (task: Task) => {
    // 1. 카운팅이 여러 번인 항목이고 숫자가 0보다 큰 경우 -> 숫자 하나 차감
    if (task.requiredCount > 1 && task.currentCount > 0) {
      const nextCount = task.currentCount - 1;
      db.runSync("UPDATE portfolio_tasks SET currentCount = ?, completed = 0 WHERE id = ?", nextCount, task.id);
      
      // 누적 연동 (감소 시에도 반영)
      if (task.category === 'triggered' || task.category === 'weekly_dept') {
        const search = task.title.includes('외래예진') ? '외래예진기록' : (task.title.includes('수술') ? '수술참관기록' : (task.title.includes('POMR') ? 'POMR' : (task.title.includes('외래참관') ? '외래참관' : null)));
        if (search) {
          const main = db.getFirstSync<Task>("SELECT * FROM portfolio_tasks WHERE category = 'event' AND title LIKE ?", `%${search}%`);
          if (main && main.currentCount > 0) db.runSync("UPDATE portfolio_tasks SET currentCount = ?, completed = 0 WHERE id = ?", main.currentCount - 1, main.id);
        }
      }
      loadTasks();
    } 
    // 2. 숫자가 0이거나 단일 항목인 경우 -> 삭제 확인 팝업
    else {
      Alert.alert("항목 삭제", "정말로 이 항목을 삭제하시겠습니까?", [
        { text: "아니오", style: 'cancel' },
        { text: "네", style: 'destructive', onPress: () => confirmDelete(task) }
      ]);
    }
  };

  const confirmDelete = (task: Task) => {
    // 삭제 시에도 체크된 상태였다면 누적 카운트 복구
    if ((task.category === 'triggered' || task.category === 'weekly_dept') && task.completed === 1) {
      const search = task.title.includes('외래예진') ? '외래예진기록' : (task.title.includes('수술') ? '수술참관기록' : (task.title.includes('POMR') ? 'POMR' : (task.title.includes('외래참관') ? '외래참관' : null)));
      if (search) {
        const main = db.getFirstSync<Task>("SELECT * FROM portfolio_tasks WHERE category = 'event' AND title LIKE ?", `%${search}%`);
        if (main && main.currentCount > 0) db.runSync("UPDATE portfolio_tasks SET currentCount = ?, completed = 0 WHERE id = ?", main.currentCount - 1, main.id);
      }
    }
    db.runSync("DELETE FROM portfolio_tasks WHERE id = ?", task.id);
    loadTasks();
  };

  const logEvent = async (type: 'outpatient' | 'surgery', label: string) => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (type === 'outpatient' ? 2 : 1));
    deadline.setHours(23, 59, 59, 999);
    const taskTitle = `${label} - ${now.getMonth()+1}/${now.getDate()} 환자`;
    try {
      db.runSync("INSERT INTO portfolio_tasks (title, category, deadlineInfo, requiredCount, currentCount, completed, isCustom, deadlineTimestamp) VALUES (?, 'triggered', ?, 1, 0, 0, 1, ?)",
        taskTitle, `${deadline.getMonth() + 1}/${deadline.getDate()} 23:59 마감`, deadline.getTime());
      Alert.alert('과제 추가 완료', `새로운 [${label}] 과제가 생성되었습니다!`);
      loadTasks();
    } catch (e) { Alert.alert('에러 발생', String(e)); }
  };

  const addTask = () => {
    if (!newTitle.trim()) return;
    db.runSync("INSERT INTO portfolio_tasks (title, category, deadlineInfo, requiredCount, isCustom) VALUES (?, ?, '개인 목표', 1, 1)", newTitle.trim(), selectedCat);
    setNewTitle(''); setAddModalVisible(false); loadTasks();
  };

  const renderTaskRow = (task: Task, isCrisis: boolean, color: string, overrideSub?: string) => {
    const themeColor = isCrisis ? '#E74C3C' : color;
    return (
      <TouchableOpacity key={task.id} style={styles.taskRow} onPress={() => handleTaskPress(task)} onLongPress={() => handleLongPress(task)}>
        <Ionicons name={task.completed === 1 ? "checkmark-circle" : "ellipse-outline"} size={26} color={task.completed === 1 ? themeColor : "#D1D9E6"} />
        <View style={styles.taskInfo}>
          <Text style={[styles.taskText, task.completed === 1 && styles.taskTextCompleted]}>{task.title}</Text>
          {/* 💡 [요청 반영] 360도 평가 아래 가이드 문구 추가 */}
          {task.title.includes('360도 다면평가') && (
            <Text style={styles.guideText}>-교수님, 전공의, 환자, 간호사, 동료중 4개 이상</Text>
          )}
          <Text style={[styles.deadlineText, { color: themeColor, fontWeight: 'bold' }]}>{overrideSub || task.deadlineInfo}</Text>
        </View>
        <View style={[styles.counterBadge, task.completed === 1 && { backgroundColor: themeColor }]}><Text style={[styles.counterText, task.completed === 1 && { color: '#FFF' }]}>{task.currentCount}/{task.requiredCount}</Text></View>
      </TouchableOpacity>
    );
  };

  const renderSection = (title: string, category: CategoryType | 'combined_weekly', icon: string, color: string) => {
    let categoryTasks = category === 'combined_weekly' ? [...tasks['weekly'], ...tasks['pre']] : tasks[category as CategoryType] || [];
    let isCrisis = category === 'daily' ? isDailyCrisis : (category === 'combined_weekly' ? isWeeklyCrisis : false);
    const completedCount = categoryTasks.filter(t => t.completed === 1).length;
    const progress = categoryTasks.length > 0 ? (completedCount / categoryTasks.length) * 100 : 0;
    return (
      <View style={[styles.section, isCrisis && styles.highPrioritySection]}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon as any} size={22} color={isCrisis ? "#E74C3C" : color} />
          <Text style={[styles.sectionTitle, isCrisis && { color: '#E74C3C' }]}>{title} {isCrisis && "(마감 임박!)"}</Text>
          <Text style={styles.progressText}>{completedCount}/{categoryTasks.length}</Text>
        </View>
        <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: isCrisis ? "#E74C3C" : color }]} /></View>
        <View style={styles.card}>
          {categoryTasks.map((task) => renderTaskRow(task, isCrisis, color))}
          <TouchableOpacity style={styles.addItemBtn} onPress={() => { setSelectedCat(category === 'combined_weekly' ? 'weekly' : (category as CategoryType)); setAddModalVisible(true); }}><Ionicons name="add-circle-outline" size={20} color="#AAA" /><Text style={styles.addItemText}>항목 추가</Text></TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTriggeredSection = (sectionNum: number, task: Task) => {
    const color = task.title.includes('외래') ? '#003594' : '#2E7D32';
    return (
      <View key={task.id} style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name={task.title.includes('외래') ? "people" : "medical"} size={22} color={color} /><Text style={styles.sectionTitle}>{sectionNum}. {task.title}</Text><Text style={styles.progressText}>{task.completed}/1</Text></View>
        <View style={styles.card}>{renderTaskRow(task, false, color)}</View>
      </View>
    );
  };

  const renderDepartmentWeekly = (startNum: number) => {
    const deptTasks = tasks['weekly_dept'] || [];
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}><Ionicons name="medical" size={22} color="#2980B9" /><Text style={styles.sectionTitle}>{startNum}. 과별 주간 권장 ({currentDept})</Text></View>
        <View style={styles.card}>
          {deptTasks.length > 0 ? deptTasks.map((task) => renderTaskRow(task, false, '#2980B9')) : <Text style={{padding: 15, color: '#999', fontStyle: 'italic', textAlign: 'center'}}>이번 주 필수 과제가 없습니다.</Text>}
          <TouchableOpacity style={styles.addItemBtn} onPress={() => { setSelectedCat('weekly_dept'); setAddModalVisible(true); }}><Ionicons name="add-circle-outline" size={20} color="#AAA" /><Text style={styles.addItemText}>항목 추가</Text></TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}><Text style={styles.title}>퀘스트 보드</Text>
          <View style={styles.tabSwitch}>
            <TouchableOpacity onPress={() => setActiveTab('weekly')} style={[styles.tabBtn, activeTab === 'weekly' && styles.tabBtnActive]}><Text style={[styles.tabBtnText, activeTab === 'weekly' && styles.tabBtnTextActive]}>일일/주간</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('rotation')} style={[styles.tabBtn, activeTab === 'rotation' && styles.tabBtnActive]}><Text style={[styles.tabBtnText, activeTab === 'rotation' && styles.tabBtnTextActive]}>실습누적</Text></TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerWarning}><Ionicons name="time" size={16} color="#E74C3C" /><Text style={styles.warningText}>일일: 02:00 / 주간: 월요일 02:00 마감</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}><View style={styles.sectionHeader}><Ionicons name="flash" size={22} color="#8E44AD" /><Text style={styles.sectionTitle}>0. 오늘의 기록</Text></View>
          <View style={styles.triggerContainer}>
            <TouchableOpacity style={[styles.triggerBtnBase, styles.outpatientBtn]} onPress={() => logEvent('outpatient', '외래예진기록')}><Ionicons name="people" size={18} color="#003594" /><Text style={styles.outpatientTxt}>외래예진</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.triggerBtnBase, styles.surgeryBtn]} onPress={() => logEvent('surgery', '수술참관')}><Ionicons name="medical" size={18} color="#2E7D32" /><Text style={styles.surgeryTxt}>수술참관</Text></TouchableOpacity>
          </View>
        </View>
        {activeTab === 'weekly' ? (<>{renderSection('1. 일일 퀘스트', 'daily', 'sunny', '#F39C12')}{renderSection('2. 주간 퀘스트 (주말 포함)', 'combined_weekly', 'calendar', '#27AE60')}{tasks['triggered'].map((task, index) => renderTriggeredSection(3 + index, task))}{renderDepartmentWeekly(3 + tasks['triggered'].length)}</>) : (<>{renderSection('1. 실습 누적 퀘스트 (전체)', 'event', 'analytics', '#2980B9')}{renderSection('2. 턴 종료 체크리스트', 'end', 'business', '#8E44AD')}</>)}
      </ScrollView>
      <Modal visible={isAddModalVisible} transparent animationType="fade"><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>항목 추가</Text><TextInput style={styles.input} placeholder="할 일을 입력하세요" value={newTitle} onChangeText={setNewTitle} autoFocus /><View style={styles.modalBtns}><TouchableOpacity onPress={() => setAddModalVisible(false)}><Text style={styles.cancelTxt}>취소</Text></TouchableOpacity><TouchableOpacity onPress={addTask} style={{marginLeft: 25}}><Text style={styles.doneTxt}>추가</Text></TouchableOpacity></View></View></View></Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5F8' },
  header: { padding: 25, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  tabSwitch: { flexDirection: 'row', backgroundColor: '#F2F5F8', borderRadius: 20, padding: 4 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16 },
  tabBtnActive: { backgroundColor: '#003594', elevation: 2 },
  tabBtnText: { fontSize: 13, fontWeight: 'bold', color: '#888' },
  tabBtnTextActive: { color: '#FFF' },
  headerWarning: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDEDEC', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, alignSelf: 'flex-start', gap: 5 },
  warningText: { color: '#E74C3C', fontSize: 11, fontWeight: 'bold' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  triggerContainer: { flexDirection: 'row', gap: 10, marginTop: 5 },
  triggerBtnBase: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, gap: 6, backgroundColor: '#fff', elevation: 2 },
  outpatientBtn: { backgroundColor: '#EBF4FF' },
  outpatientTxt: { color: '#003594', fontWeight: 'bold', fontSize: 15 },
  surgeryBtn: { backgroundColor: '#E8F5E9' },
  surgeryTxt: { color: '#2E7D32', fontWeight: 'bold', fontSize: 15 },
  section: { marginBottom: 30 },
  highPrioritySection: { backgroundColor: '#FDEDEC', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#FACDCD' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  progressText: { fontSize: 14, color: '#999', marginLeft: 'auto', fontWeight: 'bold' },
  progressBarBg: { height: 6, backgroundColor: '#E0E7ED', borderRadius: 3, marginBottom: 12, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 5, elevation: 3 },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  taskInfo: { flex: 1, marginLeft: 12 },
  taskText: { fontSize: 15, fontWeight: '600', color: '#333' },
  taskTextCompleted: { color: '#AAA', textDecorationLine: 'line-through' },
  guideText: { fontSize: 11, color: '#888', marginTop: 2, marginBottom: 2 }, // 힌트 문구 스타일
  deadlineText: { fontSize: 11, marginTop: 3 },
  counterBadge: { backgroundColor: '#F2F5F8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 10 },
  counterText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 6 },
  addItemText: { fontSize: 14, color: '#AAA', fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#FFF', borderRadius: 20, padding: 25 },
  modalTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 15 },
  input: { backgroundColor: '#F2F5F8', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 20 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancelTxt: { color: '#999', fontWeight: 'bold', fontSize: 16 },
  doneTxt: { color: '#003594', fontWeight: 'bold', fontSize: 16 },
});