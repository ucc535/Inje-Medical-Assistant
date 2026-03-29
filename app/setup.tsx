import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

// 인제대 부속병원 및 실습과 목록
const HOSPITALS = ['부산', '상계', '일산', '해운대', '해당없음'];
const DEPARTMENTS = ['내과', '내과1', '내과2', '외과', '산부인과', '소아청소년과', '정신건강의학과', '응급의학과', '지역의료', '진료역량개발과정', '방학'];

// 💡 시각적 피로도를 낮춘 100% 파스텔톤 & 빨간색 배제 팔레트
const DEPT_COLORS: { [key: string]: { bg: string, text: string } } = {
  '내과': { bg: '#E3F2FD', text: '#1565C0' },         // 부드러운 연파랑
  '내과1': { bg: '#E3F2FD', text: '#1565C0' },        // 부드러운 연파랑
  '내과2': { bg: '#EDE7F6', text: '#4527A0' },        // 차분한 연보라
  '외과': { bg: '#EFEBE9', text: '#4E342E' },         // 안정적인 모카/베이지 (빨강 완전 배제)
  '산부인과': { bg: '#FCE4EC', text: '#AD1457' },       // 따뜻한 연한 인디핑크
  '소아청소년과': { bg: '#FFF9C4', text: '#F57F17' },   // 포근한 연노랑
  '정신건강의학과': { bg: '#E8F5E9', text: '#2E7D32' }, // 눈이 편안한 연두/민트
  '응급의학과': { bg: '#E0F2F1', text: '#00695C' },     // 차분한 청록/틸 (경각심은 낮추고 안정감 부여)
  '지역의료': { bg: '#E0F7FA', text: '#00838F' },       // 맑고 연한 하늘색
  '진료역량개발과정': { bg: '#E8EAF6', text: '#3949AB' },// 부드러운 파스텔 네이비
  '방학': { bg: '#F5F5F5', text: '#616161' },         // 자극 없는 연회색
};

export default function SetupScreen() {
  const router = useRouter();
  
  // 진행 단계 (1: 이름 입력, 2: 실습 일정 입력)
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');

  // 캘린더 선택 상태
  const [tempStart, setTempStart] = useState<string | null>(null);
  const [tempEnd, setTempEnd] = useState<string | null>(null);
  
  // 실습 데이터 저장소: { '2026-03-25': { hospital: '부산', dept: '내과', color: '...', textColor: '...' }, ... }
  const [rotations, setRotations] = useState<{[key: string]: any}>({});

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [selectedHosp, setSelectedHosp] = useState('부산');
  const [selectedDept, setSelectedDept] = useState('내과');

  // 💡 이름 입력 완료 시 2단계로 (빈칸이면 무명으로 자동 처리)
  const handleNextStep = () => {
    if (!name.trim()) {
      setName('무명');
    }
    setStep(2);
  };

  // 날짜 터치 로직 (시작일 -> 종료일)
  const onDayPress = (day: any) => {
    const dateStr = day.dateString;
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd(null);
    } else {
      if (dateStr < tempStart) {
        setTempStart(dateStr);
      } else {
        setTempEnd(dateStr);
        setShowModal(true);
      }
    }
  };

  // 날짜 범위 계산 함수
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

  // 💡 병원/과 선택 완료 및 데이터 저장 (색상 포함)
  const handleSaveRotation = () => {
    if (!tempStart || !tempEnd) return;
    const dates = getDatesInRange(tempStart, tempEnd);
    const newRotations = { ...rotations };
    
    // 선택한 과목에 맞는 파스텔 색상 꺼내오기
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
    setShowModal(false);
    setTempStart(null);
    setTempEnd(null);
  };

  // 💡 캘린더 마킹 생성 (과목별 파스텔 색상 반영)
  const getMarkedDates = () => {
    let marks: any = {};
    
    // 1. 이미 저장된 실습 일정
    Object.keys(rotations).forEach(date => {
      marks[date] = { 
        startingDay: true, 
        endingDay: true, 
        color: rotations[date].color, 
        textColor: rotations[date].textColor 
      };
    });

    // 2. 현재 선택 중인 시작일
    if (tempStart) marks[tempStart] = { startingDay: true, color: '#003594', textColor: 'white' };
    // 3. 현재 선택 중인 종료일
    if (tempEnd) marks[tempEnd] = { endingDay: true, color: '#003594', textColor: 'white' };
    
    return marks;
  };

  // 모든 설정 완료 후 앱으로 진입
  const handleFinishSetup = async () => {
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

  return (
    <SafeAreaView style={styles.container}>
      {step === 1 ? (
        // ------------------ 1단계: 이름 입력 ------------------
        <View style={styles.stepContainer}>
          <Ionicons name="medical" size={60} color="#003594" style={{ marginBottom: 20 }} />
          <Text style={styles.title}>환영합니다!</Text>
          <Text style={styles.subtitle}>스마트 비서를 시작하기 위해{'\n'}의사선생님의 이름을 알려주세요.</Text>
          {/* 💡 placeholder를 영환으로 수정 */}
          <TextInput style={styles.input} placeholder="이름 입력 (예: 영환)" value={name} onChangeText={setName} autoFocus={true} />
          <TouchableOpacity style={styles.btnPrimary} onPress={handleNextStep}>
            <Text style={styles.btnText}>다음 (실습 일정 입력)</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        // ------------------ 2단계: 실습 일정 입력 ------------------
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
              theme={{
                selectedDayBackgroundColor: '#003594',
                todayTextColor: '#E74C3C',
                arrowColor: '#003594',
              }}
            />
          </View>

          {/* 등록된 실습이 있으면 하단에 저장 버튼 활성화 */}
          <TouchableOpacity style={[styles.btnFinish, Object.keys(rotations).length === 0 && styles.btnDisabled]} onPress={handleFinishSetup} disabled={Object.keys(rotations).length === 0}>
            <Text style={styles.btnText}>모든 설정 완료하고 앱 시작하기</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ------------------ 병원 및 과목 선택 모달 ------------------ */}
      <Modal visible={showModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>실습 정보 입력</Text>
            <Text style={styles.modalDate}>{tempStart} ~ {tempEnd}</Text>

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
  // 💡 키보드에 가리지 않도록 위로 바짝 끌어올린 정렬
  stepContainer: { flex: 1, justifyContent: 'flex-start', paddingTop: 120, paddingHorizontal: 30 },
  stepContainerCalendar: { flex: 1, padding: 20, paddingTop: 60 },
  header: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', lineHeight: 24, marginBottom: 40 },
  titleSmall: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  subtitleSmall: { fontSize: 14, color: '#666', marginTop: 5 },
  
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 18, fontSize: 18, borderWidth: 1, borderColor: '#E1E8EE', marginBottom: 20 },
  btnPrimary: { backgroundColor: '#003594', padding: 18, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  btnFinish: { backgroundColor: '#003594', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  btnDisabled: { backgroundColor: '#A0B2D1' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  calendarWrapper: { backgroundColor: '#fff', borderRadius: 20, padding: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },

  // 모달 스타일
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