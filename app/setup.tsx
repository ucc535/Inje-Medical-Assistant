import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

// 인제대 부속병원 및 실습과 목록
const HOSPITALS = ['부산', '상계', '일산', '해운대', '해당없음'];
const DEPARTMENTS = ['내과', '내과1', '내과2', '외과', '산부인과', '소아청소년과', '정신건강의학과', '응급의학과', '지역의료', '진료역량개발과정', '방학'];

// 💡 필수 실습 과목 및 요구 주수 기준표 (엑셀 스케줄 기준 2주 반영 완)
const REQUIRED_WEEKS: { [key: string]: number } = {
  '외과': 6,
  '산부인과': 6,
  '소아청소년과': 4,
  '정신건강의학과': 4,
  '응급의학과': 2,
  '지역의료': 2,          
  '진료역량개발과정': 2   
};

const DEPT_COLORS: { [key: string]: { bg: string, text: string } } = {
  '내과': { bg: '#E3F2FD', text: '#1565C0' },
  '내과1': { bg: '#E3F2FD', text: '#1565C0' },
  '내과2': { bg: '#EDE7F6', text: '#4527A0' },
  '외과': { bg: '#EFEBE9', text: '#4E342E' },
  '산부인과': { bg: '#FCE4EC', text: '#AD1457' },
  '소아청소년과': { bg: '#FFF9C4', text: '#F57F17' },
  '정신건강의학과': { bg: '#E8F5E9', text: '#2E7D32' },
  '응급의학과': { bg: '#E0F2F1', text: '#00695C' },
  '지역의료': { bg: '#E0F7FA', text: '#00838F' },
  '진료역량개발과정': { bg: '#E8EAF6', text: '#3949AB' },
  '방학': { bg: '#F5F5F5', text: '#616161' },
};

export default function SetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [tempStart, setTempStart] = useState<string | null>(null);
  const [tempEnd, setTempEnd] = useState<string | null>(null);
  const [rotations, setRotations] = useState<{[key: string]: any}>({});
  const [showModal, setShowModal] = useState(false);
  const [selectedHosp, setSelectedHosp] = useState('부산');
  const [selectedDept, setSelectedDept] = useState('내과');

  const [rotationSummary, setRotationSummary] = useState<{ start: string, end: string, hospital: string, dept: string, weeks: number }[]>([]);

  const handleNextStep = () => {
    if (!name.trim()) setName('무명');
    setStep(2);
  };

  const onDayPress = (day: any) => {
    const dateStr = day.dateString;
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd(null);
    } else {
      if (dateStr < tempStart) setTempStart(dateStr);
      else {
        setTempEnd(dateStr);
        setShowModal(true);
      }
    }
  };

  const getDatesInRange = (start: string, end: string) => {
    const dates = [];
    let curr = new Date(start);
    const endDate = new Date(end);
    while (curr <= endDate) {
      const year = curr.getFullYear();
      const month = String(curr.getMonth() + 1).padStart(2, '0');
      const day = String(curr.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  };

  const calculateWeeks = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
    return Math.round(diffDays / 7); 
  };

  const handleSaveRotation = () => {
    if (!tempStart || !tempEnd) return;
    const dates = getDatesInRange(tempStart, tempEnd);
    const newRotations = { ...rotations };
    const selectedColor = DEPT_COLORS[selectedDept] || { bg: '#E3F2FD', text: '#1565C0' };
    
    dates.forEach((date) => {
      newRotations[date] = { 
        hospital: selectedHosp, 
        dept: selectedDept,
        color: selectedColor.bg,
        textColor: selectedColor.text
      };
    });

    setRotations(newRotations);
    
    const weeks = calculateWeeks(tempStart, tempEnd);
    setRotationSummary(prev => [...prev, { start: tempStart, end: tempEnd, hospital: selectedHosp, dept: selectedDept, weeks: weeks }]);

    setShowModal(false);
    setTempStart(null);
    setTempEnd(null);
  };

  const handleRemoveLastRotation = () => {
    if (rotationSummary.length === 0) return;
    Alert.alert("일정 삭제", "가장 마지막으로 등록한 일정을 지우시겠습니까?", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => {
          const lastItem = rotationSummary[rotationSummary.length - 1];
          const datesToRemove = getDatesInRange(lastItem.start, lastItem.end);
          const newRotations = { ...rotations };
          datesToRemove.forEach(date => delete newRotations[date]);
          
          setRotations(newRotations);
          setRotationSummary(prev => prev.slice(0, -1));
        }
      }
    ]);
  };

  const validateRotations = () => {
    let totalInternalMedWeeks = 0;
    const deptWeeks: { [key: string]: number } = {};

    rotationSummary.forEach(item => {
      if (item.dept.includes('내과')) {
        totalInternalMedWeeks += item.weeks;
      } else {
        deptWeeks[item.dept] = (deptWeeks[item.dept] || 0) + item.weeks;
      }
    });

    const missingDepts = [];

    if (totalInternalMedWeeks < 12) {
      missingDepts.push(`내과 계열 (12주 필요, 현재 ${totalInternalMedWeeks}주)`);
    }

    for (const [dept, reqWeeks] of Object.entries(REQUIRED_WEEKS)) {
      if ((deptWeeks[dept] || 0) < reqWeeks) {
        missingDepts.push(`${dept} (${reqWeeks}주 필요, 현재 ${deptWeeks[dept] || 0}주)`);
      }
    }

    if (missingDepts.length > 0) {
      Alert.alert(
        "필수 실습 부족!",
        `다음 과목들의 실습 일정이 부족합니다.\n\n${missingDepts.join('\n')}\n\n이대로 앱을 시작하시겠습니까?`,
        [
          { text: "돌아가서 수정", style: "cancel" },
          { text: "그냥 시작할래요", onPress: finalizeSetup }
        ]
      );
      return false;
    }
    return true;
  };

  const handleFinishSetup = () => {
    if (validateRotations()) {
      finalizeSetup();
    }
  };

  const finalizeSetup = async () => {
    try {
      const finalName = name.trim() || '무명';
      await AsyncStorage.setItem('user_name', finalName);
      await AsyncStorage.setItem('user_rotations', JSON.stringify(rotations));
      router.replace('/(tabs)');
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '저장에 실패했습니다.');
    }
  };

  const getMarkedDates = () => {
    let marks: any = {};
    Object.keys(rotations).forEach(date => {
      marks[date] = { startingDay: true, endingDay: true, color: rotations[date].color, textColor: rotations[date].textColor };
    });
    if (tempStart) marks[tempStart] = { startingDay: true, color: '#003594', textColor: 'white' };
    if (tempEnd) marks[tempEnd] = { endingDay: true, color: '#003594', textColor: 'white' };
    return marks;
  };

  const formatDateShort = (dateStr: string) => {
    const [, m, d] = dateStr.split('-');
    return `${parseInt(m)}/${parseInt(d)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {step === 1 ? (
        <View style={styles.stepContainer}>
          <Ionicons name="medical" size={60} color="#003594" style={{ marginBottom: 20 }} />
          <Text style={styles.title}>환영합니다!</Text>
          <Text style={styles.subtitle}>스마트 비서를 시작하기 위해{'\n'}의사선생님의 이름을 알려주세요.</Text>
          <TextInput style={styles.input} placeholder="이름 입력 (예: 영환)" value={name} onChangeText={setName} autoFocus={true} />
          <TouchableOpacity style={styles.btnPrimary} onPress={handleNextStep}>
            <Text style={styles.btnText}>다음 (실습 일정 입력)</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.stepContainerCalendar}>
          <View style={styles.header}>
            <Text style={styles.titleSmall}>임상실습(PK) 일정 등록</Text>
            <Text style={styles.subtitleSmall}>시작일과 종료일을 터치하여 실습을 등록하세요.</Text>
          </View>

          <View style={styles.calendarWrapper}>
            <Calendar
              markingType={'period'}
              markedDates={getMarkedDates()}
              onDayPress={onDayPress}
              theme={{ selectedDayBackgroundColor: '#003594', todayTextColor: '#E74C3C', arrowColor: '#003594' }}
            />
          </View>

          <View style={styles.summaryContainer}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>📝 등록된 실습 내역</Text>
              {rotationSummary.length > 0 && (
                <TouchableOpacity onPress={handleRemoveLastRotation}>
                  <Text style={styles.undoText}>마지막 삭제 ↺</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
              {rotationSummary.length === 0 ? (
                <Text style={styles.emptySummary}>달력에서 날짜를 선택해 일정을 추가해보세요.</Text>
              ) : (
                rotationSummary.map((item, index) => (
                  <View key={index} style={[styles.summaryItem, { borderLeftColor: DEPT_COLORS[item.dept]?.text || '#CCC' }]}>
                    <Text style={styles.summaryDate}>{formatDateShort(item.start)} ~ {formatDateShort(item.end)}</Text>
                    <Text style={styles.summaryDept}>({item.weeks}주) {item.hospital} {item.dept}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          {/* 💡 여기에 경고 문구가 추가되었습니다! */}
          <View style={{ marginTop: 'auto' }}>
            <Text style={styles.warningText}>⚠️ 정확한 주간 과제 마감일 계산을 위해, 일정은 반드시{'\n'}<Text style={styles.highlightText}>'월요일 시작 ~ 일요일 종료'</Text>로 꽉 채워서 설정해주세요.</Text>
            <TouchableOpacity style={[styles.btnFinish, Object.keys(rotations).length === 0 && styles.btnDisabled]} onPress={handleFinishSetup} disabled={Object.keys(rotations).length === 0}>
              <Text style={styles.btnText}>모든 설정 완료하고 앱 시작하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={showModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>실습 정보 입력</Text>
            <Text style={styles.modalDate}>{tempStart} ~ {tempEnd} ({tempStart && tempEnd ? calculateWeeks(tempStart, tempEnd) : 0}주)</Text>

            <Text style={styles.sectionLabel}>병원 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
              {HOSPITALS.map(hosp => (
                <TouchableOpacity key={hosp} style={[styles.tagBtn, selectedHosp === hosp && styles.tagBtnActive]} onPress={() => setSelectedHosp(hosp)}>
                  <Text style={[styles.tagText, selectedHosp === hosp && styles.tagTextActive]}>{hosp}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>실습과 선택</Text>
            <View style={styles.deptGrid}>
              {DEPARTMENTS.map(dept => (
                <TouchableOpacity key={dept} style={[styles.tagBtn, selectedDept === dept && styles.tagBtnActive, { marginBottom: 10 }]} onPress={() => setSelectedDept(dept)}>
                  <Text style={[styles.tagText, selectedDept === dept && styles.tagTextActive]}>{dept}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => { setShowModal(false); setTempStart(null); setTempEnd(null); }}>
                <Text style={styles.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveRotation}>
                <Text style={styles.btnText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  stepContainer: { flex: 1, justifyContent: 'flex-start', paddingTop: 120, paddingHorizontal: 30 },
  stepContainerCalendar: { flex: 1, padding: 20, paddingTop: 40 },
  header: { marginBottom: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', lineHeight: 24, marginBottom: 40 },
  titleSmall: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  subtitleSmall: { fontSize: 14, color: '#666', marginTop: 5 },
  
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 18, fontSize: 18, borderWidth: 1, borderColor: '#E1E8EE', marginBottom: 20 },
  btnPrimary: { backgroundColor: '#003594', padding: 18, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  
  // 💡 마진 조정 (버튼 위 텍스트 공간 확보)
  btnFinish: { backgroundColor: '#003594', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  btnDisabled: { backgroundColor: '#A0B2D1' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  calendarWrapper: { backgroundColor: '#fff', borderRadius: 20, padding: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },

  summaryContainer: { flex: 1, marginTop: 15, marginBottom: 15, backgroundColor: '#FFF', borderRadius: 20, padding: 15, elevation: 2 },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  undoText: { color: '#E74C3C', fontSize: 13, fontWeight: 'bold' },
  summaryScroll: { flex: 1 },
  emptySummary: { color: '#999', fontSize: 13, textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  summaryItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 10, marginBottom: 8, borderLeftWidth: 4 },
  summaryDate: { fontSize: 14, color: '#666', width: 90, fontWeight: '600' },
  summaryDept: { fontSize: 15, color: '#1A1A1A', fontWeight: 'bold', flex: 1 },

  // 💡 빨간색 경고 문구 스타일 추가
  warningText: { textAlign: 'center', color: '#E74C3C', fontSize: 12, lineHeight: 18, marginBottom: 10 },
  highlightText: { fontWeight: 'bold', textDecorationLine: 'underline' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  modalDate: { fontSize: 14, color: '#003594', fontWeight: 'bold', marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: 'bold', color: '#888', marginBottom: 10, marginTop: 10 },
  scrollRow: { maxHeight: 50, marginBottom: 10 },
  deptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tagBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, backgroundColor: '#F2F5F8', borderWidth: 1, borderColor: '#E1E8EE' },
  tagBtnActive: { backgroundColor: '#003594', borderColor: '#003594' },
  tagText: { color: '#555', fontSize: 14 },
  tagTextActive: { color: '#fff', fontWeight: 'bold' },
  
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalBtnCancel: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F2F5F8', alignItems: 'center' },
  modalBtnSave: { flex: 2, padding: 16, borderRadius: 12, backgroundColor: '#003594', alignItems: 'center' },
  modalBtnCancelText: { color: '#555', fontSize: 16, fontWeight: 'bold' },
});