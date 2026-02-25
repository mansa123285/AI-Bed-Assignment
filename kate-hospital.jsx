import { useState, useEffect, useCallback } from "react";

// ─── CONSTANTS & DATA ───────────────────────────────────────────────────────

const DEPARTMENTS = [
  { id: "ed", name: "Emergency Dept (ED) Holding", color: "#ef4444", icon: "🚨", esiRange: [1, 2] },
  { id: "icu", name: "Intensive Care Unit (ICU)", color: "#f97316", icon: "🫀", esiRange: [1, 2] },
  { id: "stepdown", name: "Step-Down / Progressive Care", color: "#eab308", icon: "📈", esiRange: [2, 3] },
  { id: "medsurg", name: "Medical-Surgical (Med-Surg)", color: "#22c55e", icon: "🏥", esiRange: [3, 4] },
  { id: "isolation", name: "Isolation Rooms", color: "#8b5cf6", icon: "🔬", esiRange: [1, 5] },
];

const ESI_LABELS = {
  1: "Resuscitation (Immediate)",
  2: "Emergent (< 10 min)",
  3: "Urgent (< 30 min)",
  4: "Less Urgent (< 60 min)",
  5: "Non-Urgent (< 120 min)",
};

const ESI_COLORS = {
  1: "#dc2626",
  2: "#f97316",
  3: "#eab308",
  4: "#22c55e",
  5: "#3b82f6",
};

const CHIEF_COMPLAINTS = [
  { label: "Chest Pain", severity: 1.8, deptBias: "icu", isolation: false },
  { label: "Shortness of Breath", severity: 1.6, deptBias: "icu", isolation: false },
  { label: "Stroke Symptoms", severity: 1.9, deptBias: "icu", isolation: false },
  { label: "Cardiac Arrest", severity: 2.0, deptBias: "icu", isolation: false },
  { label: "Severe Trauma", severity: 1.9, deptBias: "ed", isolation: false },
  { label: "Abdominal Pain", severity: 1.0, deptBias: "medsurg", isolation: false },
  { label: "Fever / Infection", severity: 1.2, deptBias: "isolation", isolation: true },
  { label: "Fracture / Dislocation", severity: 0.8, deptBias: "medsurg", isolation: false },
  { label: "Laceration / Wound", severity: 0.6, deptBias: "ed", isolation: false },
  { label: "Allergic Reaction", severity: 1.4, deptBias: "ed", isolation: false },
  { label: "Seizure", severity: 1.5, deptBias: "stepdown", isolation: false },
  { label: "Diabetic Emergency", severity: 1.3, deptBias: "stepdown", isolation: false },
  { label: "Respiratory Distress", severity: 1.7, deptBias: "icu", isolation: false },
  { label: "Overdose / Poisoning", severity: 1.6, deptBias: "icu", isolation: false },
  { label: "COVID-19 Suspected", severity: 1.3, deptBias: "isolation", isolation: true },
  { label: "TB Suspected", severity: 1.1, deptBias: "isolation", isolation: true },
  { label: "Minor Sprain / Strain", severity: 0.3, deptBias: "medsurg", isolation: false },
  { label: "Headache / Migraine", severity: 0.5, deptBias: "medsurg", isolation: false },
  { label: "Back Pain", severity: 0.4, deptBias: "medsurg", isolation: false },
  { label: "Mental Health Crisis", severity: 1.2, deptBias: "stepdown", isolation: false },
];

const NURSE_TYPES = [
  "Registered Nurse (RN)",
  "Emergency Nurse",
  "ICU Nurse",
  "Triage Nurse",
  "Charge Nurse",
  "Nurse Practitioner (NP)",
];

// ─── GENERATE 100-BED DATABASE ─────────────────────────────────────────────

function generateBedDatabase() {
  const beds = [];
  const bedsPerDept = 20;
  const availabilitySlots = [0, 60, 120, 180];

  DEPARTMENTS.forEach((dept, deptIdx) => {
    for (let i = 0; i < bedsPerDept; i++) {
      const slotIndex = Math.floor(i / 5);
      const availableIn = availabilitySlots[slotIndex];
      const bedNumber = deptIdx * bedsPerDept + i + 1;

      beds.push({
        id: `BED-${String(bedNumber).padStart(3, "0")}`,
        department: dept.id,
        departmentName: dept.name,
        floor: Math.floor(i / 10) + 1,
        room: `${dept.id.toUpperCase()}-${String(i + 1).padStart(2, "0")}`,
        status: availableIn === 0 ? "available" : "occupied",
        availableInMinutes: availableIn,
        assignedPatient: null,
        features: i % 3 === 0 ? ["Ventilator", "Monitor"] : i % 3 === 1 ? ["Monitor", "IV Pump"] : ["Basic"],
      });
    }
  });
  return beds;
}

// ─── KATE AI ESI PREDICTION ENGINE ─────────────────────────────────────────

function kateAIPredictESI(vitals, complaint) {
  const cc = CHIEF_COMPLAINTS.find((c) => c.label === complaint);
  let score = 3;
  const hr = parseInt(vitals.heartRate) || 80;
  if (hr > 130 || hr < 40) score -= 1.5;
  else if (hr > 110 || hr < 50) score -= 0.8;
  else if (hr > 100 || hr < 60) score -= 0.3;
  const sbp = parseInt(vitals.systolic) || 120;
  if (sbp < 80 || sbp > 200) score -= 1.5;
  else if (sbp < 90 || sbp > 180) score -= 0.8;
  else if (sbp < 100 || sbp > 160) score -= 0.3;
  const spo2 = parseInt(vitals.spo2) || 98;
  if (spo2 < 85) score -= 2;
  else if (spo2 < 90) score -= 1.2;
  else if (spo2 < 94) score -= 0.5;
  const rr = parseInt(vitals.respRate) || 16;
  if (rr > 30 || rr < 8) score -= 1.5;
  else if (rr > 24 || rr < 10) score -= 0.8;
  const temp = parseFloat(vitals.temperature) || 98.6;
  if (temp > 104 || temp < 94) score -= 1.2;
  else if (temp > 102 || temp < 96) score -= 0.5;
  const pain = parseInt(vitals.painLevel) || 0;
  if (pain >= 9) score -= 0.8;
  else if (pain >= 7) score -= 0.4;
  const gcs = parseInt(vitals.gcs) || 15;
  if (gcs <= 8) score -= 2;
  else if (gcs <= 12) score -= 1;
  else if (gcs <= 14) score -= 0.3;
  if (cc) score -= cc.severity * 0.6;
  return Math.round(Math.max(1, Math.min(5, score)));
}

// ─── SMART BED ALLOCATION ENGINE ────────────────────────────────────────────

function computeFinalESI(nurseESI, kateESI, complaint) {
  const cc = CHIEF_COMPLAINTS.find((c) => c.label === complaint);
  const complaintWeight = cc ? cc.severity / 2 : 0;
  let weighted = nurseESI * 0.4 + kateESI * 0.35 + (5 - complaintWeight * 2.5) * 0.25;
  return Math.round(Math.max(1, Math.min(5, weighted)));
}

function computeNurseOverrideESI(nurseESI, complaint) {
  const cc = CHIEF_COMPLAINTS.find((c) => c.label === complaint);
  const complaintWeight = cc ? cc.severity / 2 : 0;
  // Nurse override: 70% nurse, 30% complaint severity
  let weighted = nurseESI * 0.7 + (5 - complaintWeight * 2.5) * 0.3;
  return Math.round(Math.max(1, Math.min(5, weighted)));
}

function allocateBed(finalESI, complaint, beds) {
  const cc = CHIEF_COMPLAINTS.find((c) => c.label === complaint);
  let deptPriority;
  if (cc?.isolation) {
    deptPriority = ["isolation", "ed", "stepdown", "medsurg", "icu"];
  } else if (finalESI === 1) {
    deptPriority = [cc?.deptBias || "icu", "icu", "ed", "stepdown", "medsurg"];
  } else if (finalESI === 2) {
    deptPriority = [cc?.deptBias || "icu", "icu", "stepdown", "ed", "medsurg"];
  } else if (finalESI === 3) {
    deptPriority = [cc?.deptBias || "stepdown", "stepdown", "medsurg", "ed", "icu"];
  } else {
    deptPriority = [cc?.deptBias || "medsurg", "medsurg", "ed", "stepdown", "icu"];
  }
  deptPriority = [...new Set(deptPriority)];
  const availableBeds = beds
    .filter((b) => !b.assignedPatient)
    .sort((a, b) => {
      const aP = deptPriority.indexOf(a.department);
      const bP = deptPriority.indexOf(b.department);
      const aPr = aP === -1 ? 99 : aP;
      const bPr = bP === -1 ? 99 : bP;
      if (aPr !== bPr) return aPr - bPr;
      return a.availableInMinutes - b.availableInMinutes;
    });
  if (availableBeds.length === 0) return null;
  if (finalESI <= 2) {
    const immediate = availableBeds.find((b) => b.availableInMinutes === 0);
    if (immediate) return immediate;
  }
  return availableBeds[0];
}

const FONT_LINK = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap";

// ─── MAIN APP ───────────────────────────────────────────────────────────────

export default function KATEHospitalSystem() {
  const [beds, setBeds] = useState(() => generateBedDatabase());
  const [view, setView] = useState("intake");
  const [patientQueue, setPatientQueue] = useState([]);
  const [showNursePopup, setShowNursePopup] = useState(false);
  const [pendingAllocation, setPendingAllocation] = useState(null);
  const [allocationHistory, setAllocationHistory] = useState([]);
  const [notification, setNotification] = useState(null);
  const [clockTime, setClockTime] = useState(new Date());
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [patientCounter, setPatientCounter] = useState(0);
  const [successAnim, setSuccessAnim] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const showNotif = useCallback((msg, type = "info") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const handlePatientSubmit = useCallback(
    (patient) => {
      const kateESI = kateAIPredictESI(patient.vitals, patient.chiefComplaint);
      const finalESI = computeFinalESI(patient.nurseESI, kateESI, patient.chiefComplaint);
      const bed = allocateBed(finalESI, patient.chiefComplaint, beds);
      const nurseOverrideESI = computeNurseOverrideESI(patient.nurseESI, patient.chiefComplaint);
      const nurseBed = allocateBed(nurseOverrideESI, patient.chiefComplaint, beds);

      const fullPatient = {
        ...patient,
        id: `PT-${Date.now().toString(36).toUpperCase()}`,
        kateESI,
        finalESI,
        nurseOverrideESI,
        timestamp: new Date(),
      };

      setPendingAllocation({ patient: fullPatient, bed, nurseBed });
      setShowNursePopup(true);
    },
    [beds]
  );

  const returnToIntake = useCallback(() => {
    setSuccessAnim(true);
    setTimeout(() => {
      setSuccessAnim(false);
      setView("intake");
    }, 2000);
  }, []);

  // Accept KATE AI weighted recommendation
  const handleAcceptAI = useCallback(() => {
    if (!pendingAllocation) return;
    const { patient, bed } = pendingAllocation;
    finishAllocation(patient, bed, "ai_accepted", patient.finalESI);
  }, [pendingAllocation]);

  // Nurse overrides with their own ESI
  const handleNurseOverride = useCallback(() => {
    if (!pendingAllocation) return;
    const { patient, nurseBed } = pendingAllocation;
    const overridePatient = { ...patient, finalESI: patient.nurseOverrideESI };
    finishAllocation(overridePatient, nurseBed, "nurse_override", patient.nurseOverrideESI);
  }, [pendingAllocation]);

  // Nurse adjusts ESI manually in the popup
  const handleCustomOverride = useCallback((customESI) => {
    if (!pendingAllocation) return;
    const { patient } = pendingAllocation;
    const customBed = allocateBed(customESI, patient.chiefComplaint, beds);
    const overridePatient = { ...patient, finalESI: customESI };
    finishAllocation(overridePatient, customBed, "nurse_custom", customESI);
  }, [pendingAllocation, beds]);

  const finishAllocation = useCallback((patient, bed, decisionType, usedESI) => {
    if (bed) {
      setBeds((prev) =>
        prev.map((b) =>
          b.id === bed.id ? { ...b, assignedPatient: patient.name, status: "assigned" } : b
        )
      );
      setAllocationHistory((prev) => [
        {
          ...patient,
          finalESI: usedESI,
          assignedBed: bed.id,
          assignedDept: bed.departmentName,
          assignedDeptId: bed.department,
          assignedRoom: bed.room,
          availableIn: bed.availableInMinutes,
          status: "assigned",
          decisionType,
          processedAt: new Date(),
          serialNumber: prev.length + 1,
        },
        ...prev,
      ]);
      setPatientCounter((c) => c + 1);
      const methodLabel = decisionType === "ai_accepted" ? "KATE AI" : decisionType === "nurse_override" ? "Nurse Override" : "Nurse Custom ESI";
      showNotif(`✓ ${patient.name} → ${bed.room} (${bed.departmentName}) via ${methodLabel}`, "success");
    } else {
      setPatientQueue((prev) =>
        [...prev, { ...patient, status: "waiting" }].sort((a, b) => a.finalESI - b.finalESI)
      );
      setAllocationHistory((prev) => [
        {
          ...patient,
          finalESI: usedESI,
          assignedBed: "—",
          assignedDept: "Queue",
          assignedDeptId: "queue",
          assignedRoom: "Waiting",
          availableIn: -1,
          status: "queued",
          decisionType,
          processedAt: new Date(),
          serialNumber: prev.length + 1,
        },
        ...prev,
      ]);
      setPatientCounter((c) => c + 1);
      showNotif(`⏳ ${patient.name} added to priority queue (ESI ${usedESI})`, "warning");
    }

    setShowNursePopup(false);
    setPendingAllocation(null);
    returnToIntake();
  }, [showNotif, returnToIntake]);

  const handleNurseDecline = useCallback(() => {
    if (!pendingAllocation) return;
    const { patient } = pendingAllocation;
    setAllocationHistory((prev) => [
      {
        ...patient,
        assignedBed: "—",
        assignedDept: "Declined",
        assignedDeptId: "declined",
        assignedRoom: "—",
        availableIn: -1,
        status: "declined",
        decisionType: "declined",
        processedAt: new Date(),
        serialNumber: prev.length + 1,
      },
      ...prev,
    ]);
    showNotif("✕ Declined — returning to intake for next patient", "error");
    setShowNursePopup(false);
    setPendingAllocation(null);
    returnToIntake();
  }, [pendingAllocation, showNotif, returnToIntake]);

  const availableNow = beds.filter((b) => b.status === "available" && !b.assignedPatient).length;
  const totalBeds = beds.length;

  const filteredHistory = allocationHistory.filter((h) => {
    const matchesSearch =
      !historySearch ||
      h.name.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.chiefComplaint.toLowerCase().includes(historySearch.toLowerCase()) ||
      h.assignedRoom.toLowerCase().includes(historySearch.toLowerCase());
    const matchesFilter =
      historyFilter === "all" ||
      (historyFilter === "assigned" && h.status === "assigned") ||
      (historyFilter === "queued" && h.status === "queued") ||
      (historyFilter === "declined" && h.status === "declined");
    return matchesSearch && matchesFilter;
  });

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(145deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)", fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#e2e8f0", position: "relative", overflow: "hidden" }}>
      <link href={FONT_LINK} rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, select, textarea { font-family: 'Plus Jakarta Sans', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glow { 0%, 100% { box-shadow: 0 0 20px rgba(56,189,248,0.1); } 50% { box-shadow: 0 0 40px rgba(56,189,248,0.25); } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes successPulse { 0% { transform: scale(0); opacity: 0; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes checkDraw { 0% { stroke-dashoffset: 48; } 100% { stroke-dashoffset: 0; } }
        @keyframes countUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes bedSwap { 0% { opacity: 1; transform: scale(1); } 30% { opacity: 0; transform: scale(0.8); } 60% { opacity: 0; transform: scale(0.8); } 100% { opacity: 1; transform: scale(1); } }
        .nav-btn { background: transparent; border: 1px solid #334155; color: #94a3b8; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.3s; font-family: 'Plus Jakarta Sans', sans-serif; }
        .nav-btn:hover { background: #1e293b; color: #e2e8f0; border-color: #475569; }
        .nav-btn.active { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; border-color: transparent; box-shadow: 0 4px 20px rgba(14,165,233,0.3); }
        .input-field { width: 100%; background: #0f172a; border: 1.5px solid #1e293b; border-radius: 10px; padding: 12px 16px; color: #e2e8f0; font-size: 14px; transition: all 0.3s; outline: none; }
        .input-field:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.15); }
        .input-field::placeholder { color: #475569; }
        select.input-field { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; cursor: pointer; }
        .btn-primary { background: linear-gradient(135deg, #0ea5e9, #0284c7); color: white; border: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.3s; font-family: 'Plus Jakarta Sans', sans-serif; letter-spacing: 0.3px; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(14,165,233,0.4); }
        .btn-danger { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.3s; font-family: 'Plus Jakarta Sans', sans-serif; }
        .btn-danger:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(239,68,68,0.4); }
        .btn-nurse { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; padding: 14px 32px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; transition: all 0.3s; font-family: 'Plus Jakarta Sans', sans-serif; }
        .btn-nurse:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(245,158,11,0.4); }
        .btn-custom { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; border: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.3s; font-family: 'Plus Jakarta Sans', sans-serif; }
        .btn-custom:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(139,92,246,0.4); }
        .card { background: linear-gradient(160deg, #1e293b 0%, #172033 100%); border: 1px solid #2a3548; border-radius: 16px; padding: 24px; }
        .bed-cell { width: 28px; height: 28px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 700; cursor: default; transition: all 0.2s; margin: 2px; }
        .bed-cell:hover { transform: scale(1.3); z-index: 2; }
        .history-fab { position: fixed; bottom: 28px; right: 28px; z-index: 800; width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg, #8b5cf6, #6d28d9); color: white; border: none; cursor: pointer; font-size: 13px; font-weight: 800; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; box-shadow: 0 8px 32px rgba(139,92,246,0.4); transition: all 0.3s; font-family: 'Plus Jakarta Sans', sans-serif; line-height: 1; }
        .history-fab:hover { transform: scale(1.08) translateY(-2px); box-shadow: 0 12px 40px rgba(139,92,246,0.55); }
        .history-badge { position: absolute; top: -6px; right: -6px; background: #ef4444; color: white; min-width: 24px; height: 24px; border-radius: 50%; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; border: 2px solid #0f172a; padding: 0 4px; }
        .filter-chip { padding: 6px 14px; border-radius: 8px; border: 1px solid #334155; background: transparent; color: #94a3b8; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; }
        .filter-chip:hover { background: #1e293b; }
        .filter-chip.active { background: #8b5cf620; border-color: #8b5cf6; color: #c4b5fd; }
        .history-item { background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; padding: 16px; transition: all 0.25s; cursor: pointer; }
        .history-item:hover { border-color: #8b5cf650; background: #141d2e; transform: translateX(-4px); }
        .decision-card { border-radius: 16px; padding: 20px; cursor: pointer; transition: all 0.3s; position: relative; overflow: hidden; }
        .decision-card:hover { transform: translateY(-3px); }
        .decision-card .radio-dot { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #475569; transition: all 0.3s; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .decision-card.selected .radio-dot { border-color: currentColor; }
        .decision-card.selected .radio-dot::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background: currentColor; }
      `}</style>

      {/* BG */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", left: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)" }} />
      </div>

      {/* Success Overlay */}
      {successAnim && (
        <div style={{ position: "fixed", inset: 0, zIndex: 950, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.3s ease" }}>
          <div style={{ animation: "successPulse 0.6s ease forwards" }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="50" fill="none" stroke="#10b981" strokeWidth="3" opacity="0.3" />
              <circle cx="55" cy="55" r="50" fill="rgba(16,185,129,0.08)" />
              <path d="M33 57 L48 72 L77 39" fill="none" stroke="#10b981" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" style={{ animation: "checkDraw 0.5s ease 0.4s forwards", strokeDashoffset: 60 }} />
            </svg>
          </div>
          <div style={{ marginTop: 28, fontSize: 24, fontWeight: 800, color: "#10b981", animation: "fadeInUp 0.4s ease 0.5s both" }}>Patient Processed Successfully</div>
          <div style={{ marginTop: 10, fontSize: 15, color: "#94a3b8", animation: "fadeInUp 0.4s ease 0.7s both" }}>Returning to intake for next patient…</div>
          <div style={{ marginTop: 28, display: "flex", gap: 36, animation: "fadeInUp 0.4s ease 0.9s both" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{patientCounter}</div>
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: "1px", marginTop: 4 }}>PROCESSED</div>
            </div>
            <div style={{ width: 1, background: "#334155" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#10b981", fontFamily: "'JetBrains Mono', monospace" }}>{availableNow}</div>
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: "1px", marginTop: 4 }}>BEDS FREE</div>
            </div>
            <div style={{ width: 1, background: "#334155" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#f59e0b", fontFamily: "'JetBrains Mono', monospace" }}>{patientQueue.length}</div>
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: "1px", marginTop: 4 }}>IN QUEUE</div>
            </div>
          </div>
          <div style={{ marginTop: 32, width: 200, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden", animation: "fadeInUp 0.4s ease 1s both" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, #10b981, #0ea5e9)", borderRadius: 2, animation: "progressBar 1.8s ease forwards" }} />
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div style={{ position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 1000, padding: "14px 28px", borderRadius: 12, background: notification.type === "success" ? "#065f46" : notification.type === "error" ? "#7f1d1d" : "#78350f", border: `1px solid ${notification.type === "success" ? "#10b981" : notification.type === "error" ? "#ef4444" : "#f59e0b"}`, color: "white", fontWeight: 600, fontSize: 14, animation: "slideDown 0.3s ease", boxShadow: "0 10px 40px rgba(0,0,0,0.4)" }}>
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <header style={{ position: "relative", zIndex: 10, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e293b", background: "rgba(15,23,42,0.8)", backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "white", boxShadow: "0 4px 20px rgba(14,165,233,0.3)" }}>K</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", background: "linear-gradient(135deg, #e2e8f0, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>KATE AI</div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase" }}>Smart Bed Allocation System</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={`nav-btn ${view === "intake" ? "active" : ""}`} onClick={() => setView("intake")}>➕ Patient Intake</button>
          <button className={`nav-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>📊 Bed Dashboard</button>
          <button className={`nav-btn ${view === "queue" ? "active" : ""}`} onClick={() => setView("queue")}>📋 Queue ({patientQueue.length})</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 13, color: "#64748b" }}>
          <div style={{ textAlign: "center", lineHeight: 1.3 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>{patientCounter}</div>
            <div style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase" }}>processed</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{clockTime.toLocaleTimeString()}</span>
          </div>
          <div style={{ padding: "6px 14px", background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b" }}>
            <span style={{ color: "#10b981", fontWeight: 700 }}>{availableNow}</span>
            <span style={{ color: "#475569" }}> / {totalBeds} beds free</span>
          </div>
        </div>
      </header>

      <main style={{ position: "relative", zIndex: 5, padding: "28px 32px", maxWidth: 1440, margin: "0 auto" }}>
        {view === "intake" && <PatientIntakeForm onSubmit={handlePatientSubmit} key={`intake-${patientCounter}`} />}
        {view === "dashboard" && <BedDashboard beds={beds} departments={DEPARTMENTS} />}
        {view === "queue" && <QueueView queue={patientQueue} />}
      </main>

      {/* ═══ ENHANCED NURSE POPUP ═══ */}
      {showNursePopup && pendingAllocation && (
        <NurseVerificationPopup
          patient={pendingAllocation.patient}
          bed={pendingAllocation.bed}
          nurseBed={pendingAllocation.nurseBed}
          beds={beds}
          onAcceptAI={handleAcceptAI}
          onNurseOverride={handleNurseOverride}
          onCustomOverride={handleCustomOverride}
          onDecline={handleNurseDecline}
        />
      )}

      {/* History FAB */}
      <button className="history-fab" onClick={() => { setHistoryPanelOpen(true); setSelectedHistoryItem(null); }}>
        <span style={{ fontSize: 22 }}>📜</span>
        <span style={{ fontSize: 9, letterSpacing: "0.5px" }}>History</span>
        {allocationHistory.length > 0 && <span className="history-badge">{allocationHistory.length}</span>}
      </button>

      {/* History Panel */}
      {historyPanelOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 850, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={() => setHistoryPanelOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }} />
          <div style={{ position: "relative", width: selectedHistoryItem ? 780 : 460, maxWidth: "92vw", background: "linear-gradient(180deg, #111827, #0f172a)", borderLeft: "1px solid #1e293b", animation: "slideInRight 0.35s cubic-bezier(0.16,1,0.3,1)", display: "flex", overflow: "hidden", transition: "width 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ width: selectedHistoryItem ? 380 : "100%", minWidth: selectedHistoryItem ? 380 : "auto", borderRight: selectedHistoryItem ? "1px solid #1e293b" : "none", display: "flex", flexDirection: "column", transition: "width 0.3s ease" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>📜 Patient History</h3>
                    <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{allocationHistory.length} total records</p>
                  </div>
                  <button onClick={() => setHistoryPanelOpen(false)} style={{ width: 36, height: 36, borderRadius: 10, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>✕</button>
                </div>
                <input className="input-field" placeholder="Search by name, complaint, room…" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} style={{ marginBottom: 12, fontSize: 13 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[{ key: "all", label: `All (${allocationHistory.length})` }, { key: "assigned", label: `✅ (${allocationHistory.filter(h => h.status === "assigned").length})` }, { key: "queued", label: `⏳ (${allocationHistory.filter(h => h.status === "queued").length})` }, { key: "declined", label: `✕ (${allocationHistory.filter(h => h.status === "declined").length})` }].map((f) => (
                    <button key={f.key} className={`filter-chip ${historyFilter === f.key ? "active" : ""}`} onClick={() => setHistoryFilter(f.key)}>{f.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
                {filteredHistory.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 48, color: "#475569" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#94a3b8" }}>{allocationHistory.length === 0 ? "No patients processed yet" : "No matching records"}</div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {filteredHistory.map((h, i) => (
                      <div key={h.id + "-" + i} className="history-item" onClick={() => setSelectedHistoryItem(h)} style={{ borderColor: selectedHistoryItem?.id === h.id ? "#8b5cf6" : "#1e293b", background: selectedHistoryItem?.id === h.id ? "#1a1f35" : "#0f172a", animation: `fadeInUp 0.3s ease ${i * 0.04}s both` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: ESI_COLORS[h.finalESI], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: h.finalESI >= 4 ? "#000" : "#fff" }}>{h.finalESI}</div>
                            <span style={{ fontSize: 8, color: "#475569" }}>ESI</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, fontWeight: 700 }}>{h.name}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: h.status === "assigned" ? "#10b98120" : h.status === "queued" ? "#f59e0b20" : "#ef444420", color: h.status === "assigned" ? "#10b981" : h.status === "queued" ? "#f59e0b" : "#ef4444" }}>
                                {h.status.toUpperCase()}
                              </span>
                              {h.decisionType && h.decisionType !== "declined" && (
                                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: h.decisionType === "ai_accepted" ? "#0ea5e920" : "#f59e0b20", color: h.decisionType === "ai_accepted" ? "#0ea5e9" : "#f59e0b" }}>
                                  {h.decisionType === "ai_accepted" ? "AI" : h.decisionType === "nurse_override" ? "NURSE" : "CUSTOM"}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{h.chiefComplaint}</div>
                            <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11 }}>
                              {h.status === "assigned" && <span style={{ color: "#0ea5e9" }}>🛏️ {h.assignedRoom}</span>}
                              <span style={{ color: "#475569" }}>{h.processedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          </div>
                          <div style={{ color: "#334155", fontSize: 18 }}>›</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {selectedHistoryItem && (
              <div style={{ flex: 1, overflowY: "auto", padding: 24, animation: "fadeIn 0.25s ease" }}>
                <HistoryDetail item={selectedHistoryItem} onClose={() => setSelectedHistoryItem(null)} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ENHANCED NURSE VERIFICATION POPUP ──────────────────────────────────────

function NurseVerificationPopup({ patient, bed, nurseBed, beds, onAcceptAI, onNurseOverride, onCustomOverride, onDecline }) {
  const [decision, setDecision] = useState("ai"); // "ai" | "nurse" | "custom"
  const [customESI, setCustomESI] = useState(patient.finalESI);
  const [customBed, setCustomBed] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const cc = CHIEF_COMPLAINTS.find((c) => c.label === patient.chiefComplaint);

  // Recompute custom bed when customESI changes
  useEffect(() => {
    if (decision === "custom") {
      const b = allocateBed(customESI, patient.chiefComplaint, beds);
      setCustomBed(b);
    }
  }, [customESI, decision, patient.chiefComplaint, beds]);

  const activeBed = decision === "ai" ? bed : decision === "nurse" ? nurseBed : customBed;
  const activeESI = decision === "ai" ? patient.finalESI : decision === "nurse" ? patient.nurseOverrideESI : customESI;

  const handleConfirm = () => {
    if (decision === "ai") onAcceptAI();
    else if (decision === "nurse") onNurseOverride();
    else onCustomOverride(customESI);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.3s ease" }}>
      <div style={{ background: "linear-gradient(160deg, #1e293b, #0f172a)", border: "1px solid #334155", borderRadius: 24, padding: 0, maxWidth: 820, width: "94%", maxHeight: "92vh", overflow: "auto", animation: "fadeInUp 0.4s ease", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}>

        {/* Header */}
        <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>🩺</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Nurse Decision Console</h2>
            <p style={{ color: "#64748b", fontSize: 13 }}>Review, accept, override, or adjust the bed allocation</p>
          </div>
        </div>

        <div style={{ padding: "20px 32px" }}>
          {/* Patient Summary */}
          <div style={{ background: "#0f172a", borderRadius: 14, padding: 18, marginBottom: 18, border: "1px solid #1e293b" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>PATIENT</span>
                <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{patient.name}</div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>COMPLAINT</span>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{patient.chiefComplaint}</div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: "#475569", fontWeight: 600 }}>COMPLAINT SEVERITY</span>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, color: cc && cc.severity >= 1.5 ? "#ef4444" : cc && cc.severity >= 1.0 ? "#f59e0b" : "#22c55e" }}>{cc?.severity.toFixed(1) || "—"} / 2.0</div>
              </div>
            </div>
          </div>

          {/* ESI Comparison Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
            <ESIBox label="Nurse ESI" score={patient.nurseESI} sublabel="Your Assessment" />
            <ESIBox label="KATE AI ESI" score={patient.kateESI} sublabel="AI Prediction" icon="🧠" />
            <ESIBox label="Weighted Final" score={patient.finalESI} sublabel="40% Nurse + 35% AI + 25% CC" icon="⚡" highlight />
          </div>

          {patient.nurseESI !== patient.kateESI && (
            <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 10, padding: "10px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span style={{ fontSize: 13, color: "#fbbf24" }}>
                <strong>Score Discrepancy:</strong> Nurse ESI ({patient.nurseESI}) differs from KATE AI ESI ({patient.kateESI}). Please review and choose your preferred course of action below.
              </span>
            </div>
          )}

          {/* ═══ DECISION CARDS ═══ */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "1px", marginBottom: 12, textTransform: "uppercase" }}>Choose Decision Path</div>

          <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
            {/* Option 1: Accept AI */}
            <div
              className={`decision-card ${decision === "ai" ? "selected" : ""}`}
              onClick={() => setDecision("ai")}
              style={{ background: decision === "ai" ? "#0ea5e910" : "#0f172a", border: `2px solid ${decision === "ai" ? "#0ea5e9" : "#1e293b"}`, color: decision === "ai" ? "#0ea5e9" : "#94a3b8" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="radio-dot" style={{ color: "#0ea5e9" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: decision === "ai" ? "#e2e8f0" : "#94a3b8" }}>✓ Accept KATE AI Recommendation</span>
                    <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 6, background: "#0ea5e920", color: "#38bdf8", fontWeight: 700 }}>RECOMMENDED</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Use weighted ESI score ({patient.finalESI}) — 40% Nurse + 35% AI + 25% Complaint Severity</div>
                </div>
                <div style={{ textAlign: "center", padding: "8px 16px", background: `${ESI_COLORS[patient.finalESI]}15`, borderRadius: 10, border: `1px solid ${ESI_COLORS[patient.finalESI]}30` }}>
                  <div style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>ESI</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: ESI_COLORS[patient.finalESI], fontFamily: "'JetBrains Mono', monospace" }}>{patient.finalESI}</div>
                </div>
              </div>
            </div>

            {/* Option 2: Nurse Override */}
            <div
              className={`decision-card ${decision === "nurse" ? "selected" : ""}`}
              onClick={() => setDecision("nurse")}
              style={{ background: decision === "nurse" ? "#f59e0b10" : "#0f172a", border: `2px solid ${decision === "nurse" ? "#f59e0b" : "#1e293b"}`, color: decision === "nurse" ? "#f59e0b" : "#94a3b8" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="radio-dot" style={{ color: "#f59e0b" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: decision === "nurse" ? "#e2e8f0" : "#94a3b8" }}>🩺 Use My Nurse Assessment</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Override AI — use nurse ESI ({patient.nurseESI}) weighted 70% + 30% complaint severity = ESI {patient.nurseOverrideESI}</div>
                </div>
                <div style={{ textAlign: "center", padding: "8px 16px", background: `${ESI_COLORS[patient.nurseOverrideESI]}15`, borderRadius: 10, border: `1px solid ${ESI_COLORS[patient.nurseOverrideESI]}30` }}>
                  <div style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>ESI</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: ESI_COLORS[patient.nurseOverrideESI], fontFamily: "'JetBrains Mono', monospace" }}>{patient.nurseOverrideESI}</div>
                </div>
              </div>
            </div>

            {/* Option 3: Custom ESI */}
            <div
              className={`decision-card ${decision === "custom" ? "selected" : ""}`}
              onClick={() => setDecision("custom")}
              style={{ background: decision === "custom" ? "#8b5cf610" : "#0f172a", border: `2px solid ${decision === "custom" ? "#8b5cf6" : "#1e293b"}`, color: decision === "custom" ? "#8b5cf6" : "#94a3b8" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div className="radio-dot" style={{ color: "#8b5cf6" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: decision === "custom" ? "#e2e8f0" : "#94a3b8" }}>🎛️ Set Custom ESI Score</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Manually assign an ESI score and recalculate bed assignment in real-time</div>
                  {decision === "custom" && (
                    <div style={{ marginTop: 14, padding: "14px 16px", background: "#0f172a", borderRadius: 12, border: "1px solid #334155", animation: "fadeInUp 0.3s ease" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>ESI Score: {customESI} — {ESI_LABELS[customESI]}</div>
                          <input
                            type="range" min={1} max={5} step={1} value={customESI}
                            onChange={(e) => setCustomESI(parseInt(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: "100%", accentColor: ESI_COLORS[customESI] }}
                          />
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                            {[1, 2, 3, 4, 5].map(n => (
                              <button
                                key={n}
                                onClick={(e) => { e.stopPropagation(); setCustomESI(n); }}
                                style={{
                                  width: 32, height: 32, borderRadius: 8, border: `2px solid ${customESI === n ? ESI_COLORS[n] : "#334155"}`,
                                  background: customESI === n ? ESI_COLORS[n] : "transparent",
                                  color: customESI === n ? (n >= 4 ? "#000" : "#fff") : "#64748b",
                                  fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                                  transition: "all 0.2s",
                                }}
                              >{n}</button>
                            ))}
                          </div>
                        </div>
                        <div style={{ textAlign: "center", padding: "8px 16px", background: `${ESI_COLORS[customESI]}15`, borderRadius: 10, border: `1px solid ${ESI_COLORS[customESI]}30` }}>
                          <div style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>ESI</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: ESI_COLORS[customESI], fontFamily: "'JetBrains Mono', monospace" }}>{customESI}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {decision !== "custom" && (
                  <div style={{ textAlign: "center", padding: "8px 16px", background: `${ESI_COLORS[customESI]}15`, borderRadius: 10, border: `1px solid ${ESI_COLORS[customESI]}30` }}>
                    <div style={{ fontSize: 9, color: "#475569", fontWeight: 600 }}>ESI</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: ESI_COLORS[customESI], fontFamily: "'JetBrains Mono', monospace" }}>{customESI}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ LIVE BED ASSIGNMENT PREVIEW ═══ */}
          <div style={{ background: activeBed ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)", border: `1.5px solid ${activeBed ? "#10b981" : "#ef4444"}30`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: activeBed ? "#10b981" : "#ef4444", letterSpacing: "1px", textTransform: "uppercase" }}>
                {activeBed ? "🛏️ Bed Assignment Preview" : "⚠️ No Beds Available"}
              </div>
              <div style={{ padding: "4px 12px", borderRadius: 6, background: decision === "ai" ? "#0ea5e920" : decision === "nurse" ? "#f59e0b20" : "#8b5cf620", fontSize: 11, fontWeight: 700, color: decision === "ai" ? "#38bdf8" : decision === "nurse" ? "#fbbf24" : "#c4b5fd" }}>
                {decision === "ai" ? "AI Weighted" : decision === "nurse" ? "Nurse Override" : "Custom ESI"} → ESI {activeESI}
              </div>
            </div>
            {activeBed ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                <div>
                  <span style={{ fontSize: 10, color: "#475569" }}>BED ID</span>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{activeBed.id}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#475569" }}>ROOM</span>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{activeBed.room}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#475569" }}>DEPARTMENT</span>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{activeBed.departmentName}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "#475569" }}>AVAILABLE IN</span>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: activeBed.availableInMinutes === 0 ? "#10b981" : "#f59e0b" }}>
                    {activeBed.availableInMinutes === 0 ? "NOW" : `${activeBed.availableInMinutes} min`}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: "#f87171", fontSize: 14, fontWeight: 600 }}>Patient will be added to priority queue based on ESI {activeESI}</div>
            )}
          </div>

          {/* Scoring Breakdown */}
          <div style={{ background: "#0f172a", borderRadius: 12, padding: 16, marginBottom: 20, border: "1px solid #1e293b" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "1px", marginBottom: 10, textTransform: "uppercase" }}>
              {decision === "ai" ? "AI Weighted Scoring" : decision === "nurse" ? "Nurse Override Scoring" : "Custom Override"} Breakdown
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {decision === "ai" ? (
                <>
                  <WeightBar label="Nurse" pct={40} color="#0ea5e9" />
                  <WeightBar label="KATE AI" pct={35} color="#8b5cf6" />
                  <WeightBar label="Complaint" pct={25} color="#f59e0b" extra={`Severity: ${cc?.severity?.toFixed(1) || "—"}`} />
                </>
              ) : decision === "nurse" ? (
                <>
                  <WeightBar label="Nurse" pct={70} color="#f59e0b" />
                  <WeightBar label="Complaint" pct={30} color="#f59e0b" extra={`Severity: ${cc?.severity?.toFixed(1) || "—"}`} />
                </>
              ) : (
                <>
                  <WeightBar label="Nurse Manual" pct={100} color="#8b5cf6" extra={`Direct ESI ${customESI} assignment`} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ padding: "16px 32px 28px", borderTop: "1px solid #1e293b", display: "flex", gap: 12 }}>
          <button
            onClick={handleConfirm}
            style={{
              flex: 2, padding: "16px 24px", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 15, transition: "all 0.3s", color: "white",
              background: decision === "ai" ? "linear-gradient(135deg, #0ea5e9, #0284c7)" : decision === "nurse" ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              boxShadow: decision === "ai" ? "0 6px 24px rgba(14,165,233,0.3)" : decision === "nurse" ? "0 6px 24px rgba(245,158,11,0.3)" : "0 6px 24px rgba(139,92,246,0.3)",
            }}
            onMouseEnter={(e) => e.target.style.transform = "translateY(-2px)"}
            onMouseLeave={(e) => e.target.style.transform = "none"}
          >
            {decision === "ai" ? "✓ Confirm AI Recommendation" : decision === "nurse" ? "🩺 Confirm Nurse Override" : `🎛️ Confirm Custom ESI ${customESI}`}
            {activeBed ? ` → ${activeBed.room}` : " → Queue"}
          </button>
          <button className="btn-danger" onClick={onDecline} style={{ flex: 1, padding: "16px 24px", borderRadius: 14 }}>
            ✕ Decline All
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HISTORY DETAIL ─────────────────────────────────────────────────────────

function HistoryDetail({ item, onClose }) {
  const statusConfig = {
    assigned: { color: "#10b981", bg: "#10b98110", label: "BED ASSIGNED", icon: "✅" },
    queued: { color: "#f59e0b", bg: "#f59e0b10", label: "IN QUEUE", icon: "⏳" },
    declined: { color: "#ef4444", bg: "#ef444410", label: "DECLINED", icon: "✕" },
  };
  const sc = statusConfig[item.status] || statusConfig.declined;
  const decisionLabels = { ai_accepted: "KATE AI Weighted", nurse_override: "Nurse Override", nurse_custom: "Custom ESI", declined: "Declined" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: sc.color, letterSpacing: "1px" }}>{sc.icon} {sc.label}</span>
            {item.decisionType && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: item.decisionType === "ai_accepted" ? "#0ea5e920" : item.decisionType === "declined" ? "#ef444420" : "#f59e0b20", color: item.decisionType === "ai_accepted" ? "#38bdf8" : item.decisionType === "declined" ? "#ef4444" : "#fbbf24", fontWeight: 700 }}>
                {decisionLabels[item.decisionType] || item.decisionType}
              </span>
            )}
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800 }}>{item.name}</h3>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>ID: {item.id} · #{item.serialNumber} · {item.processedAt.toLocaleString()}</p>
        </div>
        <button onClick={onClose} style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>✕</button>
      </div>

      <div style={{ background: "#0f172a", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #1e293b" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "1px", marginBottom: 12 }}>PATIENT DETAILS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DetailRow label="Date of Birth" value={item.dob || "—"} />
          <DetailRow label="Nurse Type" value={item.nurseType || "—"} />
          <DetailRow label="Triage Time" value={item.triageTime ? new Date(item.triageTime).toLocaleString() : "—"} />
          <DetailRow label="Chief Complaint" value={item.chiefComplaint} highlight />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        <MiniESI label="Nurse" score={item.nurseESI} />
        <MiniESI label="KATE AI" score={item.kateESI} icon="🧠" />
        <MiniESI label="Used ESI" score={item.finalESI} icon="⚡" highlight />
      </div>

      {item.vitals && (
        <div style={{ background: "#0f172a", borderRadius: 14, padding: 18, marginBottom: 14, border: "1px solid #1e293b" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "1px", marginBottom: 12 }}>VITALS AT TRIAGE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[{ label: "Heart Rate", val: item.vitals.heartRate, unit: "bpm" }, { label: "SpO₂", val: item.vitals.spo2, unit: "%" }, { label: "BP", val: `${item.vitals.systolic || "—"}/${item.vitals.diastolic || "—"}`, unit: "mmHg" }, { label: "Resp Rate", val: item.vitals.respRate, unit: "/min" }, { label: "Temp", val: item.vitals.temperature, unit: "°F" }, { label: "Pain", val: item.vitals.painLevel, unit: "/10" }, { label: "GCS", val: item.vitals.gcs, unit: "/15" }].map((v) => (
              <div key={v.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #1e293b" }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{v.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{v.val || "—"} <span style={{ color: "#475569", fontWeight: 400 }}>{v.unit}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: sc.bg, borderRadius: 14, padding: 18, border: `1px solid ${sc.color}25` }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: sc.color, letterSpacing: "1px", marginBottom: 12 }}>BED ASSIGNMENT</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <DetailRow label="Bed ID" value={item.assignedBed} />
          <DetailRow label="Room" value={item.assignedRoom} />
          <DetailRow label="Department" value={item.assignedDept} />
          <DetailRow label="Wait Time" value={item.availableIn === 0 ? "Immediate" : item.availableIn > 0 ? `${item.availableIn} minutes` : "—"} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#475569", fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: highlight ? 700 : 600, color: highlight ? "#f8fafc" : "#cbd5e1" }}>{value}</div>
    </div>
  );
}

function MiniESI({ label, score, icon, highlight }) {
  return (
    <div style={{ background: highlight ? `${ESI_COLORS[score]}12` : "#0f172a", border: `1.5px solid ${highlight ? ESI_COLORS[score] + "50" : "#1e293b"}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: ESI_COLORS[score], fontFamily: "'JetBrains Mono', monospace" }}>{icon ? `${icon} ` : ""}{score}</div>
      <div style={{ fontSize: 8, color: "#475569", marginTop: 2 }}>{ESI_LABELS[score]}</div>
    </div>
  );
}

function ESIBox({ label, score, sublabel, icon, highlight }) {
  return (
    <div style={{ background: highlight ? `${ESI_COLORS[score]}15` : "#0f172a", border: `1.5px solid ${highlight ? ESI_COLORS[score] + "60" : "#1e293b"}`, borderRadius: 14, padding: 14, textAlign: "center", animation: highlight ? "glow 2s infinite" : "none" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: ESI_COLORS[score], fontFamily: "'JetBrains Mono', monospace", textShadow: highlight ? `0 0 20px ${ESI_COLORS[score]}60` : "none" }}>{icon ? `${icon} ` : ""}{score}</div>
      <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{sublabel}</div>
      <div style={{ fontSize: 8, color: ESI_COLORS[score], marginTop: 2, fontWeight: 600 }}>{ESI_LABELS[score]}</div>
    </div>
  );
}

function WeightBar({ label, pct, color, extra }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
      {extra && <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>{extra}</div>}
    </div>
  );
}

// ─── PATIENT INTAKE FORM ────────────────────────────────────────────────────

function PatientIntakeForm({ onSubmit }) {
  const [form, setForm] = useState({ name: "", dob: "", nurseType: "", triageTime: new Date().toISOString().slice(0, 16), chiefComplaint: "", nurseESI: 3, vitals: { heartRate: "", systolic: "", diastolic: "", spo2: "", respRate: "", temperature: "", painLevel: "", gcs: "15" } });
  const updateForm = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const updateVital = (key, val) => setForm((p) => ({ ...p, vitals: { ...p.vitals, [key]: val } }));

  const handleSubmit = () => {
    if (!form.name || !form.dob || !form.chiefComplaint || !form.nurseType) { alert("Please fill in all required fields: Name, DOB, Nurse Type, and Chief Complaint."); return; }
    onSubmit(form);
  };

  return (
    <div style={{ animation: "fadeInUp 0.5s ease" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Patient Intake</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>Enter patient information. KATE AI will analyze vitals, predict ESI score, and allocate the optimal bed.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card" style={{ animation: "fadeInUp 0.5s ease 0.1s both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(14,165,233,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>
            <h3 style={{ fontSize: 17, fontWeight: 700 }}>Patient Profile</h3>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <FieldGroup label="Patient Name *"><input className="input-field" placeholder="Full name" value={form.name} onChange={(e) => updateForm("name", e.target.value)} autoFocus /></FieldGroup>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FieldGroup label="Date of Birth *"><input className="input-field" type="date" value={form.dob} onChange={(e) => updateForm("dob", e.target.value)} /></FieldGroup>
              <FieldGroup label="Triage Time"><input className="input-field" type="datetime-local" value={form.triageTime} onChange={(e) => updateForm("triageTime", e.target.value)} /></FieldGroup>
            </div>
            <FieldGroup label="Nurse Type *">
              <select className="input-field" value={form.nurseType} onChange={(e) => updateForm("nurseType", e.target.value)}>
                <option value="">Select nurse type…</option>
                {NURSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Chief Complaint *">
              <select className="input-field" value={form.chiefComplaint} onChange={(e) => updateForm("chiefComplaint", e.target.value)}>
                <option value="">Select chief complaint…</option>
                {CHIEF_COMPLAINTS.map((c) => <option key={c.label} value={c.label}>{c.label}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label={`Nurse Predicted ESI Score: ${form.nurseESI} — ${ESI_LABELS[form.nurseESI]}`}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
                <input type="range" min={1} max={5} step={1} value={form.nurseESI} onChange={(e) => updateForm("nurseESI", parseInt(e.target.value))} style={{ flex: 1, accentColor: ESI_COLORS[form.nurseESI] }} />
                <div style={{ width: 48, height: 48, borderRadius: 12, background: ESI_COLORS[form.nurseESI], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: form.nurseESI >= 4 ? "#000" : "#fff", boxShadow: `0 4px 20px ${ESI_COLORS[form.nurseESI]}40` }}>{form.nurseESI}</div>
              </div>
            </FieldGroup>
          </div>
        </div>
        <div className="card" style={{ animation: "fadeInUp 0.5s ease 0.2s both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>💓</div>
            <h3 style={{ fontSize: 17, fontWeight: 700 }}>Vital Signs</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <VitalInput label="Heart Rate" unit="bpm" placeholder="60-100" value={form.vitals.heartRate} onChange={(v) => updateVital("heartRate", v)} color={vitalColor(form.vitals.heartRate, 60, 100, 40, 130)} />
            <VitalInput label="SpO₂" unit="%" placeholder="95-100" value={form.vitals.spo2} onChange={(v) => updateVital("spo2", v)} color={vitalColor(form.vitals.spo2, 95, 100, 85, 101)} />
            <VitalInput label="Systolic BP" unit="mmHg" placeholder="90-140" value={form.vitals.systolic} onChange={(v) => updateVital("systolic", v)} color={vitalColor(form.vitals.systolic, 90, 140, 80, 200)} />
            <VitalInput label="Diastolic BP" unit="mmHg" placeholder="60-90" value={form.vitals.diastolic} onChange={(v) => updateVital("diastolic", v)} color={vitalColor(form.vitals.diastolic, 60, 90, 50, 120)} />
            <VitalInput label="Resp. Rate" unit="/min" placeholder="12-20" value={form.vitals.respRate} onChange={(v) => updateVital("respRate", v)} color={vitalColor(form.vitals.respRate, 12, 20, 8, 30)} />
            <VitalInput label="Temperature" unit="°F" placeholder="97-99" value={form.vitals.temperature} onChange={(v) => updateVital("temperature", v)} color={vitalColor(form.vitals.temperature, 97, 99, 94, 104)} />
            <VitalInput label="Pain Level" unit="/10" placeholder="0-10" value={form.vitals.painLevel} onChange={(v) => updateVital("painLevel", v)} color={vitalColor(form.vitals.painLevel, 0, 4, -1, 10)} />
            <VitalInput label="GCS Score" unit="/15" placeholder="3-15" value={form.vitals.gcs} onChange={(v) => updateVital("gcs", v)} color={vitalColor(form.vitals.gcs, 13, 15, 3, 16)} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
        <button className="btn-primary" onClick={handleSubmit} style={{ padding: "16px 64px", fontSize: 16, borderRadius: 14 }}>🧠 Run KATE AI Analysis & Allocate Bed</button>
      </div>
    </div>
  );
}

function vitalColor(val, normalLow, normalHigh, critLow, critHigh) {
  if (!val || val === "") return "#475569";
  const n = parseFloat(val);
  if (n >= normalLow && n <= normalHigh) return "#10b981";
  if (n < critLow || n > critHigh) return "#ef4444";
  return "#f59e0b";
}

function VitalInput({ label, unit, placeholder, value, onChange, color }) {
  return (
    <div style={{ background: "#0f172a", border: `1.5px solid ${value ? color + "40" : "#1e293b"}`, borderRadius: 12, padding: "12px 14px", transition: "all 0.3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
        <span style={{ fontSize: 10, color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{unit}</span>
      </div>
      <input className="input-field" style={{ background: "transparent", border: "none", padding: 0, fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: value ? color : "#475569" }} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FieldGroup({ label, children }) {
  return (<div><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, letterSpacing: "0.3px" }}>{label}</label>{children}</div>);
}

// ─── BED DASHBOARD ──────────────────────────────────────────────────────────

function BedDashboard({ beds, departments }) {
  return (
    <div style={{ animation: "fadeInUp 0.5s ease" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Bed Dashboard</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>Real-time view of all 100 beds across 5 departments</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Beds" value={beds.length} icon="🏥" color="#0ea5e9" />
        <StatCard label="Available Now" value={beds.filter(b => b.status === "available" && !b.assignedPatient).length} icon="✅" color="#10b981" />
        <StatCard label="Assigned" value={beds.filter(b => b.assignedPatient).length} icon="👤" color="#8b5cf6" />
        <StatCard label="Occupied" value={beds.filter(b => b.status === "occupied" && !b.assignedPatient).length} icon="⏳" color="#f59e0b" />
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        {departments.map((dept, i) => {
          const deptBeds = beds.filter((b) => b.department === dept.id);
          const available = deptBeds.filter((b) => b.status === "available" && !b.assignedPatient).length;
          const assignedBeds = deptBeds.filter((b) => b.assignedPatient).length;
          const upcoming1h = deptBeds.filter(b => b.availableInMinutes <= 60 && b.status === "occupied" && !b.assignedPatient).length;
          return (
            <div key={dept.id} className="card" style={{ animation: `fadeInUp 0.4s ease ${i * 0.08}s both` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${dept.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{dept.icon}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{dept.name}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>ESI {dept.esiRange[0]}–{dept.esiRange[1]} priority</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                  <span style={{ color: "#10b981" }}><strong>{available}</strong> free</span>
                  <span style={{ color: "#8b5cf6" }}><strong>{assignedBeds}</strong> assigned</span>
                  <span style={{ color: "#f59e0b" }}><strong>{upcoming1h}</strong> soon</span>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {deptBeds.map((bed) => {
                  let bg, textC;
                  if (bed.assignedPatient) { bg = "#8b5cf6"; textC = "#fff"; }
                  else if (bed.status === "available") { bg = "#10b981"; textC = "#fff"; }
                  else if (bed.availableInMinutes <= 60) { bg = "#f59e0b30"; textC = "#f59e0b"; }
                  else if (bed.availableInMinutes <= 120) { bg = "#f9731630"; textC = "#f97316"; }
                  else { bg = "#ef444420"; textC = "#ef4444"; }
                  return (<div key={bed.id} className="bed-cell" style={{ background: bg, color: textC }} title={`${bed.id} — ${bed.room}\n${bed.assignedPatient ? `Patient: ${bed.assignedPatient}` : bed.status === "available" ? "Available" : `Available in ${bed.availableInMinutes} min`}`}>{bed.id.slice(-2)}</div>);
                })}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 14, paddingTop: 12, borderTop: "1px solid #1e293b" }}>
                {[0, 60, 120, 180].map(t => {
                  const count = deptBeds.filter(b => b.availableInMinutes === t && !b.assignedPatient && (t === 0 ? b.status === "available" : b.status === "occupied")).length;
                  return (<div key={t} style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: t === 0 ? "#10b981" : t === 60 ? "#f59e0b" : t === 120 ? "#f97316" : "#ef4444" }} />{t === 0 ? "Now" : `${t / 60}h`}: <strong style={{ color: "#e2e8f0" }}>{count}</strong></div>);
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 24, fontSize: 12, color: "#64748b" }}>
        {[{ color: "#10b981", label: "Available Now" }, { color: "#8b5cf6", label: "Assigned" }, { color: "#f59e0b", label: "Free in 1h" }, { color: "#f97316", label: "Free in 2h" }, { color: "#ef4444", label: "Free in 3h" }].map(l => (<div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />{l.label}</div>))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (<div className="card" style={{ textAlign: "center", padding: "20px 16px" }}><div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div><div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div><div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 4 }}>{label}</div></div>);
}

// ─── QUEUE VIEW ─────────────────────────────────────────────────────────────

function QueueView({ queue }) {
  return (
    <div style={{ animation: "fadeInUp 0.5s ease" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>Priority Queue</h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>Patients sorted by ESI priority (highest acuity first)</p>
      </div>
      <div className="card">
        {queue.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 6 }}>Queue is clear</div>
            <div style={{ fontSize: 14 }}>All patients have been assigned beds</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {queue.map((p, i) => (
              <div key={p.id} style={{ background: "#0f172a", borderRadius: 14, padding: 18, border: `1px solid ${i === 0 ? ESI_COLORS[p.finalESI] + "40" : "#1e293b"}`, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#475569", fontFamily: "'JetBrains Mono', monospace", width: 30, textAlign: "center" }}>#{i + 1}</div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: ESI_COLORS[p.finalESI], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: p.finalESI >= 4 ? "#000" : "#fff", boxShadow: i === 0 ? `0 4px 20px ${ESI_COLORS[p.finalESI]}40` : "none" }}>{p.finalESI}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{p.chiefComplaint}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: "#475569" }}>
                  <div>Nurse: {p.nurseESI} · AI: {p.kateESI}</div>
                  <div style={{ color: ESI_COLORS[p.finalESI], fontWeight: 700 }}>Final: {p.finalESI}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
