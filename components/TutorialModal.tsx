import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface TutorialProps {
  visible: boolean;
  onClose: () => void;
}

const TUTORIAL_STEPS = [
  {
    title: "🏠 홈: 실습 브리핑",
    content: "오늘 내가 갈 병원 위치에 맞춰 날씨를 알려드려요. 비 소식이 있으면 우산을 챙기라고 제가 툭 찔러드릴게요. 우측 상단 🍴 버튼으로 오늘 학식도 바로 확인하세요!",
    icon: "home-outline",
    color: "#003594"
  },
  {
    title: "📅 캘린더: 로테이션 흐름",
    content: "실습 과목의 시작과 끝을 ( ) 괄호로 한눈에 보여드려요. 과거 날짜를 누르면 그날 썼던 임상 메모나 인계록을 복기할 수 있어 시험 공부에 딱입니다.",
    icon: "calendar-outline",
    color: "#4A90E2"
  },
  {
    title: "✅ 체크리스트: 과제 마감",
    content: "가장 중요한 탭입니다! 튜토리얼 과제, 연구 논문 등 마감일을 등록하세요. 마감 2시간 전엔 홈 화면에 붉은 배너를 띄워 영환님의 학점을 수호합니다. 🛡️",
    icon: "checkmark-done-circle-outline",
    color: "#E74C3C"
  },
  {
    title: "🍱 식단 & 🕒 시간표",
    content: "매번 찾아보기 힘든 주간 학식을 사진이나 텍스트로 보관하세요. 시간표 탭에선 영환님뿐만 아니라 동기들 시간표도 모아볼 수 있어 약속 잡기 편합니다.",
    icon: "restaurant-outline",
    color: "#F39C12"
  },
  {
    title: "🔍 Quick Find & 자료실",
    content: "설정 탭의 검색창은 마법 같아요. 일정, 메모, 과제 속 모든 텍스트를 한꺼번에 뒤져줍니다. 교수님 연락처나 스키마는 'Clinical Box'에 넣어두면 실습 중에 천하무적!",
    icon: "search-outline",
    color: "#9B59B6"
  }
];

export default function TutorialModal({ visible, onClose }: TutorialProps) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < TUTORIAL_STEPS.length - 1) setStep(step + 1);
    else {
      setStep(0);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={[styles.iconBox, { backgroundColor: TUTORIAL_STEPS[step].color + '15' }]}>
            <Ionicons name={TUTORIAL_STEPS[step].icon as any} size={45} color={TUTORIAL_STEPS[step].color} />
          </View>
          
          <Text style={styles.title}>{TUTORIAL_STEPS[step].title}</Text>
          <Text style={styles.description}>{TUTORIAL_STEPS[step].content}</Text>

          <View style={styles.footer}>
            <View style={styles.dotRow}>
              {TUTORIAL_STEPS.map((_, i) => (
                <View key={i} style={[styles.dot, step === i && { backgroundColor: TUTORIAL_STEPS[step].color, width: 20 }]} />
              ))}
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
                <Text style={styles.skipText}>건너뛰기</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleNext} 
                style={[styles.nextBtn, { backgroundColor: TUTORIAL_STEPS[step].color }]}
              >
                <Text style={styles.nextText}>
                  {step === TUTORIAL_STEPS.length - 1 ? "실습 시작!" : "다음"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  content: { width: '85%', backgroundColor: '#FFF', borderRadius: 32, padding: 30, alignItems: 'center', elevation: 10 },
  iconBox: { width: 90, height: 90, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15 },
  description: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 35 },
  footer: { width: '100%', alignItems: 'center' },
  dotRow: { flexDirection: 'row', gap: 6, marginBottom: 30 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EEE' },
  btnRow: { flexDirection: 'row', gap: 15, width: '100%' },
  skipBtn: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  skipText: { color: '#BBB', fontWeight: 'bold' },
  nextBtn: { flex: 2, paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
  nextText: { color: '#FFF', fontWeight: 'bold' },
});