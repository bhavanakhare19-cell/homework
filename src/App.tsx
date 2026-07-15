/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Users, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Database, 
  Sparkles, 
  User, 
  Shield, 
  Award, 
  ArrowRight, 
  Check, 
  ExternalLink, 
  Lock, 
  HelpCircle,
  FileCode,
  LogOut,
  ChevronRight,
  TrendingUp,
  Inbox
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from './supabase-config';

// Define Interfaces
interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'student' | 'admin';
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  points: number;
  created_by?: string;
  created_at?: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_text: string;
  attachment_url?: string;
  grade?: number;
  feedback?: string;
  graded_at?: string;
  graded_by?: string;
  status: 'pending' | 'graded';
  created_at: string;
}

// Default Mock Data for Sandbox Mode
const INITIAL_STUDENTS: Profile[] = [
  { id: 'stud-1', full_name: 'Alice Vance', email: 'alice@academy.edu', role: 'student' },
  { id: 'stud-2', full_name: 'Bob Miller', email: 'bob@academy.edu', role: 'student' },
  { id: 'stud-3', full_name: 'Charlie Smith', email: 'charlie@academy.edu', role: 'student' },
];

const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg-1',
    title: 'Essay: The Ethics of AI in Software Engineering',
    description: 'Write a 1,500-word critical essay exploring the socio-technical implications, copyright concerns, and accountability when leveraging LLMs for automated code generation.',
    due_date: '2026-07-20',
    points: 100,
  },
  {
    id: 'asg-2',
    title: 'Lab: Distributed Systems and Containerization',
    description: 'Configure a multi-tier client-server application, optimize it for a cloud-native sandbox, handle horizontal scaling, and ensure secure communication.',
    due_date: '2026-07-25',
    points: 100,
  },
  {
    id: 'asg-3',
    title: 'Homework: Advanced TypeScript Algorithms',
    description: 'Implement complex generic structures, recursive mapped types, conditional type utility constraints, and a complete graph traversal solver with strict safety configurations.',
    due_date: '2026-07-30',
    points: 50,
  }
];

const INITIAL_SUBMISSIONS: Submission[] = [
  {
    id: 'sub-1',
    assignment_id: 'asg-1',
    student_id: 'stud-1',
    submission_text: 'In this essay, I analyze the shifting landscape of intellectual property under algorithmic generators. Developers must implement clean filters to prevent regression issues...',
    attachment_url: 'https://github.com/alicev/ai-ethics-paper',
    grade: 96,
    feedback: 'Outstanding research and critical synthesis, Alice! Your breakdown of developer liability is remarkably detailed.',
    graded_at: '2026-07-14T10:30:00Z',
    graded_by: 'admin-1',
    status: 'graded',
    created_at: '2026-07-13T14:20:00Z'
  },
  {
    id: 'sub-2',
    assignment_id: 'asg-1',
    student_id: 'stud-2',
    submission_text: 'An investigation into corporate compliance when developers use generative code completion. We argue that auditability is a major challenge for organizations moving forward.',
    attachment_url: 'https://github.com/bobm/ethics-essay',
    status: 'pending',
    created_at: '2026-07-14T09:15:00Z'
  }
];

export default function App() {
  const isConfigured = isSupabaseConfigured();

  // Mode & Authorization states
  const [supabaseMode, setSupabaseMode] = useState<boolean>(isConfigured);
  const [authRole, setAuthRole] = useState<'student' | 'admin'>('student');
  
  // Real Supabase Auth states
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [sessionProfile, setSessionProfile] = useState<Profile | null>(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Core Data States
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  
  // Sandbox Active User selection (allows switching on the fly)
  const [selectedStudent, setSelectedStudent] = useState<Profile>(INITIAL_STUDENTS[0]);

  // View & UI states
  const [currentTab, setCurrentTab] = useState<'assignments' | 'students' | 'submissions'>('assignments');
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState<Assignment | null>(null);
  const [showGradeModal, setShowGradeModal] = useState<Submission | null>(null);
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);

  // New Assignment Form State
  const [newAsgTitle, setNewAsgTitle] = useState('');
  const [newAsgDesc, setNewAsgDesc] = useState('');
  const [newAsgDueDate, setNewAsgDueDate] = useState('');
  const [newAsgPoints, setNewAsgPoints] = useState(100);

  // New Submission Form State
  const [submitText, setSubmitText] = useState('');
  const [submitUrl, setSubmitUrl] = useState('');

  // Grading Form State
  const [gradeScore, setGradeScore] = useState<number>(100);
  const [gradeFeedback, setGradeFeedback] = useState('');

  // Notification Banner State
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 1. Initial Data Loading & Synchronization
  useEffect(() => {
    if (supabaseMode && isConfigured) {
      loadSupabaseData();
      // Listen to Auth State Changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        setSessionUser(session?.user ?? null);
        if (session?.user) {
          fetchAndSetProfile(session.user.id);
        } else {
          setSessionProfile(null);
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Local Sandbox initialization with LocalStorage
      const localAsg = localStorage.getItem('edurealm_assignments');
      const localSub = localStorage.getItem('edurealm_submissions');
      const localStud = localStorage.getItem('edurealm_students');

      if (localAsg) {
        setAssignments(JSON.parse(localAsg));
      } else {
        setAssignments(INITIAL_ASSIGNMENTS);
        localStorage.setItem('edurealm_assignments', JSON.stringify(INITIAL_ASSIGNMENTS));
      }

      if (localSub) {
        setSubmissions(JSON.parse(localSub));
      } else {
        setSubmissions(INITIAL_SUBMISSIONS);
        localStorage.setItem('edurealm_submissions', JSON.stringify(INITIAL_SUBMISSIONS));
      }

      if (localStud) {
        setStudents(JSON.parse(localStud));
      } else {
        setStudents(INITIAL_STUDENTS);
        localStorage.setItem('edurealm_students', JSON.stringify(INITIAL_STUDENTS));
      }
    }
  }, [supabaseMode, isConfigured]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // 2. Supabase Integration Actions
  const loadSupabaseData = async () => {
    try {
      // Load Assignments
      const { data: asgData, error: asgErr } = await supabase
        .from('assignments')
        .select('*')
        .order('due_date', { ascending: true });
      if (asgErr) throw asgErr;
      setAssignments(asgData || []);

      // Load Profiles (Students)
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');
      if (profErr) throw profErr;
      setStudents(profData || []);

      // Load Submissions
      const { data: subData, error: subErr } = await supabase
        .from('submissions')
        .select('*');
      if (subErr) throw subErr;
      setSubmissions(subData || []);
    } catch (err: any) {
      console.error('Error loading Supabase data:', err.message);
      showToast(`Database read error: ${err.message}`, 'error');
    }
  };

  const fetchAndSetProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      if (error) throw error;
      setSessionProfile(data);
      setAuthRole(data.role);
      showToast(`Welcome back, ${data.full_name}!`, 'success');
    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
    }
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isSignUp) {
        // Sign Up with metadata role
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              full_name: authFullName,
              role: authRole,
            }
          }
        });
        if (error) throw error;
        showToast('Account created successfully! Please check your email or log in.', 'success');
        setIsSignUp(false);
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        if (data.user) {
          fetchAndSetProfile(data.user.id);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'An error occurred during authentication.');
      showToast(err.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (supabaseMode) {
      await supabase.auth.signOut();
      setSessionUser(null);
      setSessionProfile(null);
    }
    showToast('Logged out successfully', 'info');
  };

  // 3. Assignment Actions (Admin Only)
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsgTitle.trim()) return;

    const newAssignment: Omit<Assignment, 'id'> = {
      title: newAsgTitle,
      description: newAsgDesc,
      due_date: newAsgDueDate || new Date().toISOString().split('T')[0],
      points: Number(newAsgPoints),
      created_by: supabaseMode ? sessionUser?.id : 'admin-1',
    };

    if (supabaseMode) {
      try {
        const { data, error } = await supabase
          .from('assignments')
          .insert([newAssignment])
          .select();
        if (error) throw error;
        setAssignments([...assignments, ...data]);
        showToast('Assignment created successfully on Supabase!', 'success');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    } else {
      // Sandbox implementation
      const completeAsg: Assignment = {
        ...newAssignment,
        id: `asg-${Date.now()}`
      };
      const updated = [...assignments, completeAsg];
      setAssignments(updated);
      localStorage.setItem('edurealm_assignments', JSON.stringify(updated));
      showToast('Assignment created successfully (Sandbox Mode)', 'success');
    }

    // Reset Form
    setNewAsgTitle('');
    setNewAsgDesc('');
    setNewAsgDueDate('');
    setNewAsgPoints(100);
    setShowAddAssignment(false);
  };

  // 4. Submission Actions (Student Only)
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showSubmitModal) return;

    const newSubmission: Omit<Submission, 'id' | 'created_at'> = {
      assignment_id: showSubmitModal.id,
      student_id: supabaseMode ? sessionUser?.id : selectedStudent.id,
      submission_text: submitText,
      attachment_url: submitUrl || undefined,
      status: 'pending'
    };

    if (supabaseMode) {
      try {
        const { data, error } = await supabase
          .from('submissions')
          .insert([newSubmission])
          .select();
        if (error) throw error;
        setSubmissions([...submissions, ...data]);
        showToast('Work submitted successfully to Supabase!', 'success');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    } else {
      // Sandbox implementation
      const completeSub: Submission = {
        ...newSubmission,
        id: `sub-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      
      // Remove any existing submissions for this assignment-student pair to respect unique constraints
      const filtered = submissions.filter(
        s => !(s.assignment_id === showSubmitModal.id && s.student_id === selectedStudent.id)
      );
      const updated = [...filtered, completeSub];
      
      setSubmissions(updated);
      localStorage.setItem('edurealm_submissions', JSON.stringify(updated));
      showToast('Assignment submitted (Sandbox Mode)', 'success');
    }

    // Reset Form
    setSubmitText('');
    setSubmitUrl('');
    setShowSubmitModal(null);
  };

  // 5. Grading Actions (Admin Only)
  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showGradeModal) return;

    const gradingData = {
      grade: Number(gradeScore),
      feedback: gradeFeedback,
      status: 'graded' as const,
      graded_at: new Date().toISOString(),
      graded_by: supabaseMode ? sessionUser?.id : 'admin-1',
    };

    if (supabaseMode) {
      try {
        const { data, error } = await supabase
          .from('submissions')
          .update(gradingData)
          .eq('id', showGradeModal.id)
          .select();
        if (error) throw error;
        
        const updatedSubs = submissions.map(s => s.id === showGradeModal.id ? { ...s, ...gradingData } : s);
        setSubmissions(updatedSubs);
        showToast('Submission graded and saved to Supabase!', 'success');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    } else {
      // Sandbox implementation
      const updatedSubs = submissions.map(s => {
        if (s.id === showGradeModal.id) {
          return {
            ...s,
            ...gradingData
          };
        }
        return s;
      });
      setSubmissions(updatedSubs);
      localStorage.setItem('edurealm_submissions', JSON.stringify(updatedSubs));
      showToast('Grade submitted successfully (Sandbox Mode)', 'success');
    }

    // Reset Form
    setGradeScore(100);
    setGradeFeedback('');
    setShowGradeModal(null);
  };

  // Reset Sandbox State to original high-fidelity mock records
  const resetSandbox = () => {
    localStorage.removeItem('edurealm_assignments');
    localStorage.removeItem('edurealm_submissions');
    localStorage.removeItem('edurealm_students');
    setAssignments(INITIAL_ASSIGNMENTS);
    setSubmissions(INITIAL_SUBMISSIONS);
    setStudents(INITIAL_STUDENTS);
    setSelectedStudent(INITIAL_STUDENTS[0]);
    showToast('Sandbox refreshed to original mock database!', 'info');
  };

  // Statistics Computations
  const getStudentStats = (studentId: string) => {
    const studentSubs = submissions.filter(s => s.student_id === studentId);
    const submittedCount = studentSubs.length;
    const gradedSubs = studentSubs.filter(s => s.status === 'graded');
    const gradedCount = gradedSubs.length;
    
    let avgGrade = 0;
    if (gradedCount > 0) {
      const sum = gradedSubs.reduce((acc, curr) => acc + (curr.grade || 0), 0);
      avgGrade = Math.round((sum / gradedCount) * 10) / 10;
    }

    return {
      submittedCount,
      pendingCount: submittedCount - gradedCount,
      gradedCount,
      avgGrade,
    };
  };

  const getAdminStats = () => {
    const pendingCount = submissions.filter(s => s.status === 'pending').length;
    const totalAssignments = assignments.length;
    const gradedSubs = submissions.filter(s => s.status === 'graded');
    
    let classAverage = 0;
    if (gradedSubs.length > 0) {
      const sum = gradedSubs.reduce((acc, curr) => acc + (curr.grade || 0), 0);
      classAverage = Math.round((sum / gradedSubs.length) * 10) / 10;
    }

    return {
      pendingCount,
      totalAssignments,
      classAverage,
      totalStudents: supabaseMode ? students.length : INITIAL_STUDENTS.length,
    };
  };

  const activeUserStats = getStudentStats(supabaseMode ? (sessionUser?.id || '') : selectedStudent.id);
  const adminStats = getAdminStats();

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-800 font-sans flex flex-col selection:bg-indigo-100 selection:text-indigo-900" id="portal-root">
      
      {/* Dynamic Toast Notification */}
      {notification && (
        <div 
          id="toast-notification"
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {notification.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
          {notification.type === 'info' && <Sparkles className="w-5 h-5 text-indigo-600" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Top Main Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 md:px-8 flex flex-col sm:flex-row gap-4 items-center justify-between" id="top-nav">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-950">Student-Admin Portal</h1>
            <p className="text-xs text-slate-500 font-medium">Supabase-Powered Learning Environment</p>
          </div>
        </div>

        {/* Global Controls & Mode Indicators */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              id="mode-btn-sandbox"
              onClick={() => {
                setSupabaseMode(false);
                setSessionUser(null);
                setSessionProfile(null);
                showToast('Switched to local state Sandbox Mode', 'info');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                !supabaseMode 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Sandbox Demo
            </button>
            <button
              id="mode-btn-supabase"
              onClick={() => {
                if (!isConfigured) {
                  showToast('Real Supabase credentials not found. Using local sandbox. Click "Setup Supabase" to configure!', 'error');
                  setShowSetupInstructions(true);
                  return;
                }
                setSupabaseMode(true);
                showToast('Switched to Live Supabase Connection', 'success');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                supabaseMode 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-indigo-600'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              Live Supabase
              {!isConfigured && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              )}
            </button>
          </div>

          {/* Setup Help Button */}
          <button
            id="setup-help-toggle"
            onClick={() => setShowSetupInstructions(!showSetupInstructions)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-950 bg-white border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 transition"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Setup Guide</span>
          </button>

          {/* Sandbox Reset Button */}
          {!supabaseMode && (
            <button
              id="btn-reset-sandbox"
              onClick={resetSandbox}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl hover:bg-rose-100 transition"
              title="Reset sandbox storage to default mock records"
            >
              Reset Data
            </button>
          )}
        </div>
      </header>

      {/* Connection warning or educational banner */}
      {showSetupInstructions && (
        <div className="bg-white border-b border-slate-200 p-6 animate-in slide-in-from-top duration-300" id="setup-instructions-drawer">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
                <FileCode className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">How to Setup Live Supabase Integration</h3>
                <p className="text-sm text-slate-600 mt-1">
                  This portal is fully rigged for real Supabase authentication and database syncing! Follow these steps to connect your own Supabase instance:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">Step 1</span>
                    <h4 className="font-semibold text-sm text-slate-900">Initialize Schema</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Copy the contents of <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">schema.sql</code> and paste them into the <strong>SQL Editor</strong> inside your Supabase dashboard, then hit Run.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">Step 2</span>
                    <h4 className="font-semibold text-sm text-slate-900">Paste Credentials</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Edit the placeholder values in <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">supabase-config.js</code> with your actual Project URL and Anon Key.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">Step 3</span>
                    <h4 className="font-semibold text-sm text-slate-900">Configure Environment</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Alternatively, set <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">VITE_SUPABASE_URL</code> and <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-mono text-[11px]">VITE_SUPABASE_ANON_KEY</code> in your environment variables.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex gap-4">
                  <button
                    onClick={() => setShowSetupInstructions(false)}
                    className="text-xs font-semibold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
                  >
                    Got it! Close Instructions
                  </button>
                  <a 
                    href="https://supabase.com" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 self-center"
                  >
                    Go to Supabase Dashboard <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col gap-6" id="main-content">
        
        {/* Sandbox Role Controller Indicator Bar */}
        {!supabaseMode && (
          <div className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4" id="sandbox-controller-bar">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl mt-0.5">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-amber-900 text-sm">Sandbox Simulation Engine Active</h3>
                <p className="text-xs text-amber-700 mt-0.5 max-w-xl">
                  You are viewing the simulated database. Toggle roles below to test how students and school administrators experience the platform instantly, no databases required!
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-white p-1.5 rounded-xl border border-amber-200 shadow-sm w-full md:w-auto justify-center">
              
              {/* Role Selection */}
              <button
                id="btn-role-student"
                onClick={() => {
                  setAuthRole('student');
                  showToast('Role switched to Student (Sandbox)', 'info');
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
                  authRole === 'student' 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <User className="w-4 h-4" />
                As Student:
              </button>

              {/* Student Selector Dropdown */}
              {authRole === 'student' && (
                <select
                  id="sandbox-student-select"
                  value={selectedStudent.id}
                  onChange={(e) => {
                    const found = INITIAL_STUDENTS.find(s => s.id === e.target.value);
                    if (found) {
                      setSelectedStudent(found);
                      showToast(`Simulating as ${found.full_name}`, 'info');
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-800 font-medium text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {INITIAL_STUDENTS.map(stud => (
                    <option key={stud.id} value={stud.id}>{stud.full_name}</option>
                  ))}
                </select>
              )}

              <button
                id="btn-role-admin"
                onClick={() => {
                  setAuthRole('admin');
                  showToast('Role switched to School Administrator (Sandbox)', 'info');
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
                  authRole === 'admin' 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4" />
                As Administrator
              </button>
            </div>
          </div>
        )}

        {/* Live Supabase Auth Screen (If supabase is configured & user isn't logged in) */}
        {supabaseMode && !sessionUser && (
          <div className="max-w-md mx-auto w-full bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden mt-6" id="auth-container">
            <div className="bg-indigo-900 text-white px-6 py-8 text-center relative">
              <div className="absolute top-4 right-4 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                Live Supabase
              </div>
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-indigo-200" />
              <h2 className="text-2xl font-extrabold tracking-tight">Access Your Portal</h2>
              <p className="text-xs text-indigo-200 mt-1">Connect to your Supabase-backed coursework database</p>
            </div>

            <form onSubmit={handleAuthAction} className="p-6 md:p-8 flex flex-col gap-5">
              {authError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {isSignUp && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Full Name</label>
                  <input
                    id="auth-input-fullname"
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    className="border border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Email Address</label>
                <input
                  id="auth-input-email"
                  type="email"
                  required
                  placeholder="name@academy.edu"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="border border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
                <input
                  id="auth-input-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="border border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                />
              </div>

              {isSignUp && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      id="auth-role-select-student"
                      onClick={() => setAuthRole('student')}
                      className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                        authRole === 'student' 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <User className="w-5 h-5" />
                      Student
                    </button>
                    <button
                      type="button"
                      id="auth-role-select-admin"
                      onClick={() => setAuthRole('admin')}
                      className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                        authRole === 'admin' 
                          ? 'border-slate-900 bg-slate-900 text-white' 
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <Shield className="w-5 h-5" />
                      Administrator
                    </button>
                  </div>
                </div>
              )}

              <button
                id="auth-submit-btn"
                type="submit"
                disabled={authLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 rounded-xl transition shadow-lg shadow-indigo-600/10 mt-2 flex items-center justify-center gap-2"
              >
                {authLoading ? 'Syncing...' : isSignUp ? 'Create Account' : 'Sign In To Portal'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center mt-3">
                <button
                  type="button"
                  id="auth-toggle-mode"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Dashboard Content Panel (Active in Sandbox OR when Supabase is configured and logged in) */}
        {(!supabaseMode || (supabaseMode && sessionUser)) && (
          <div className="flex flex-col gap-6" id="dashboard-layout">
            
            {/* Header User Identity & Quick statistics row */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6" id="dashboard-identity-panel">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${authRole === 'admin' ? 'bg-slate-900 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
                  {authRole === 'admin' ? <Shield className="w-8 h-8" /> : <User className="w-8 h-8" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                      {supabaseMode ? (sessionProfile?.full_name || 'Active Admin') : (authRole === 'admin' ? 'Dr. Elizabeth Vance' : selectedStudent.full_name)}
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      authRole === 'admin' ? 'bg-slate-900 text-white' : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      {authRole}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {supabaseMode ? (sessionUser?.email) : (authRole === 'admin' ? 'vance@academy.edu' : selectedStudent.email)}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full lg:w-auto">
                {authRole === 'student' ? (
                  <>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between" id="stat-student-submitted">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Submitted Work</span>
                      <span className="text-2xl font-extrabold text-slate-950 mt-1">{activeUserStats.submittedCount}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between" id="stat-student-pending">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Grading</span>
                      <span className="text-2xl font-extrabold text-amber-600 mt-1">{activeUserStats.pendingCount}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between col-span-2 sm:col-span-1" id="stat-student-grade">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Average Score</span>
                      <span className="text-2xl font-extrabold text-emerald-600 mt-1">
                        {activeUserStats.avgGrade > 0 ? `${activeUserStats.avgGrade}%` : 'N/A'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between" id="stat-admin-pending">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Needs Grading</span>
                      <span className="text-2xl font-extrabold text-amber-600 mt-1">{adminStats.pendingCount}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between" id="stat-admin-assignments">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Coursework Items</span>
                      <span className="text-2xl font-extrabold text-slate-950 mt-1">{adminStats.totalAssignments}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between col-span-2 sm:col-span-1" id="stat-admin-average">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Course Average</span>
                      <span className="text-2xl font-extrabold text-emerald-600 mt-1">
                        {adminStats.classAverage > 0 ? `${adminStats.classAverage}%` : 'N/A'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Logout Button (Live Supabase Only) */}
              {supabaseMode && (
                <button
                  id="btn-logout"
                  onClick={handleLogout}
                  className="text-xs font-bold text-slate-600 hover:text-rose-600 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 self-center"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              )}
            </div>

            {/* Admin Tabs vs Student Tabs */}
            {authRole === 'admin' ? (
              <div className="flex flex-col gap-6" id="admin-panel-content">
                
                {/* Admin Subheader Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
                  <div className="flex gap-4 border-b sm:border-b-0">
                    <button
                      id="admin-tab-assignments"
                      onClick={() => setCurrentTab('assignments')}
                      className={`pb-3 text-sm font-bold border-b-2 transition ${
                        currentTab === 'assignments' 
                          ? 'border-indigo-600 text-indigo-700' 
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Manage Assignments
                    </button>
                    <button
                      id="admin-tab-submissions"
                      onClick={() => setCurrentTab('submissions')}
                      className={`pb-3 text-sm font-bold border-b-2 transition flex items-center gap-1.5 ${
                        currentTab === 'submissions' 
                          ? 'border-indigo-600 text-indigo-700' 
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Grading Queue
                      {adminStats.pendingCount > 0 && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {adminStats.pendingCount}
                        </span>
                      )}
                    </button>
                    <button
                      id="admin-tab-students"
                      onClick={() => setCurrentTab('students')}
                      className={`pb-3 text-sm font-bold border-b-2 transition ${
                        currentTab === 'students' 
                          ? 'border-indigo-600 text-indigo-700' 
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Student Profiles
                    </button>
                  </div>

                  <button
                    id="admin-create-assignment-btn"
                    onClick={() => setShowAddAssignment(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-600/10 flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" />
                    New Assignment
                  </button>
                </div>

                {/* Assignment Creator Form Modal Drawer */}
                {showAddAssignment && (
                  <div className="bg-white border-2 border-indigo-100 rounded-3xl p-6 md:p-8 animate-in slide-in-from-top duration-200" id="create-assignment-form-container">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-indigo-600" />
                        Add New Coursework Assignment
                      </h3>
                      <button 
                        id="close-assignment-form-btn"
                        onClick={() => setShowAddAssignment(false)} 
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                    </div>

                    <form onSubmit={handleCreateAssignment} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="md:col-span-2 flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Assignment Title</label>
                        <input
                          id="new-assignment-title"
                          type="text"
                          required
                          placeholder="e.g. Lab 4: Designing Secure Postgres Schemas"
                          value={newAsgTitle}
                          onChange={(e) => setNewAsgTitle(e.target.value)}
                          className="border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                        />
                      </div>

                      <div className="md:col-span-2 flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Task Description & Instructions</label>
                        <textarea
                          id="new-assignment-desc"
                          rows={4}
                          placeholder="Provide clear technical objectives, deliverables, and resource links."
                          value={newAsgDesc}
                          onChange={(e) => setNewAsgDesc(e.target.value)}
                          className="border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Due Date</label>
                        <input
                          id="new-assignment-due"
                          type="date"
                          value={newAsgDueDate}
                          onChange={(e) => setNewAsgDueDate(e.target.value)}
                          className="border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Max Potential Points</label>
                        <input
                          id="new-assignment-points"
                          type="number"
                          required
                          min={1}
                          max={1000}
                          value={newAsgPoints}
                          onChange={(e) => setNewAsgPoints(Number(e.target.value))}
                          className="border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                        />
                      </div>

                      <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                        <button
                          type="button"
                          id="new-assignment-cancel"
                          onClick={() => setShowAddAssignment(false)}
                          className="px-5 py-2.5 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          id="new-assignment-submit"
                          className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/10"
                        >
                          Publish Assignment
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* TAB: ASSIGNMENTS (ADMIN VIEW) */}
                {currentTab === 'assignments' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="admin-assignments-list">
                    {assignments.length === 0 ? (
                      <div className="col-span-full bg-white border border-slate-200 rounded-3xl p-12 text-center" id="empty-assignments-admin">
                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h4 className="font-bold text-slate-900 text-lg">No assignments created yet</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Click "New Assignment" in the toolbar above to set up your syllabus goals.
                        </p>
                      </div>
                    ) : (
                      assignments.map(asg => {
                        const subsForAsg = submissions.filter(s => s.assignment_id === asg.id);
                        const gradedSubs = subsForAsg.filter(s => s.status === 'graded');
                        const pendingSubs = subsForAsg.filter(s => s.status === 'pending');
                        
                        return (
                          <div 
                            key={asg.id} 
                            id={`admin-asg-card-${asg.id}`}
                            className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition group duration-200"
                          >
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  {asg.points} PTS MAX
                                </span>
                                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-600 transition flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {asg.due_date}
                                </span>
                              </div>

                              <h4 className="font-extrabold text-slate-950 text-base leading-snug group-hover:text-indigo-600 transition">
                                {asg.title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                                {asg.description || 'No descriptive details supplied.'}
                              </p>
                            </div>

                            <div className="border-t border-slate-100 pt-4 mt-4 grid grid-cols-2 gap-2 text-center">
                              <div className="bg-emerald-50/60 p-2 rounded-xl">
                                <span className="text-[10px] text-emerald-700 font-bold block uppercase tracking-wider">Graded</span>
                                <span className="text-lg font-black text-emerald-800">{gradedSubs.length}</span>
                              </div>
                              <div className="bg-amber-50/60 p-2 rounded-xl">
                                <span className="text-[10px] text-amber-700 font-bold block uppercase tracking-wider">Pending</span>
                                <span className="text-lg font-black text-amber-800">{pendingSubs.length}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* TAB: GRADING QUEUE (ADMIN VIEW) */}
                {currentTab === 'submissions' && (
                  <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden" id="admin-submissions-queue">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">Coursework Grading Queue</h4>
                      <span className="text-xs font-semibold text-slate-500">
                        Showing {submissions.length} total submissions
                      </span>
                    </div>

                    {submissions.length === 0 ? (
                      <div className="p-12 text-center" id="empty-submissions-admin">
                        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h4 className="font-bold text-slate-900 text-base">Grading queue is empty</h4>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Students haven't submitted any papers yet. Test by switching role to student!
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {submissions.map(sub => {
                          const assignment = assignments.find(a => a.id === sub.assignment_id);
                          const student = supabaseMode 
                            ? students.find(s => s.id === sub.student_id)
                            : INITIAL_STUDENTS.find(s => s.id === sub.student_id);

                          return (
                            <div 
                              key={sub.id} 
                              id={`admin-sub-row-${sub.id}`}
                              className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-slate-950 text-sm">
                                    {student?.full_name || 'Anonymous Student'}
                                  </span>
                                  <span className="text-xs text-slate-400">•</span>
                                  <span className="text-xs text-slate-500 font-semibold">
                                    {student?.email}
                                  </span>
                                  <span className="text-xs text-slate-400">•</span>
                                  <span className="text-xs text-slate-500">
                                    Submitted {new Date(sub.created_at).toLocaleDateString()}
                                  </span>
                                </div>

                                <h5 className="font-extrabold text-indigo-700 text-sm mt-1">
                                  {assignment?.title || 'Unknown Assignment'}
                                </h5>

                                <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-150">
                                  "{sub.submission_text}"
                                </p>

                                {sub.attachment_url && (
                                  <a 
                                    href={sub.attachment_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2.5 self-start"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    View Repository / Work Resource
                                  </a>
                                )}
                              </div>

                              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto justify-end">
                                {sub.status === 'graded' ? (
                                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200/50 rounded-2xl px-4 py-2.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    <div className="text-right">
                                      <span className="text-[10px] text-emerald-700 font-extrabold block uppercase tracking-wider">Score Recorded</span>
                                      <span className="text-base font-black text-emerald-900">
                                        {sub.grade} / {assignment?.points || 100}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    id={`admin-grade-btn-${sub.id}`}
                                    onClick={() => {
                                      setGradeScore(assignment?.points || 100);
                                      setShowGradeModal(sub);
                                    }}
                                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-5 py-3 rounded-xl transition shadow-md shadow-slate-900/10 flex items-center gap-1.5 w-full sm:w-auto justify-center"
                                  >
                                    <Award className="w-4 h-4" />
                                    Grade Submission
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: STUDENT PROFILES (ADMIN VIEW) */}
                {currentTab === 'students' && (
                  <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden" id="admin-students-list-container">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                      <h4 className="font-bold text-slate-900 text-sm">Classroom Roster</h4>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {(supabaseMode ? students : INITIAL_STUDENTS).map(stud => {
                        const stats = getStudentStats(stud.id);
                        return (
                          <div key={stud.id} id={`admin-stud-row-${stud.id}`} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                            <div>
                              <h5 className="font-bold text-slate-950 text-sm">{stud.full_name}</h5>
                              <p className="text-xs text-slate-400 mt-0.5">{stud.email}</p>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Submissions</span>
                                <span className="font-extrabold text-slate-800">{stats.submittedCount} items</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Average Score</span>
                                <span className="font-extrabold text-emerald-600">
                                  {stats.avgGrade > 0 ? `${stats.avgGrade}%` : 'No grades'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              // STUDENT VIEW CONTAINER
              <div className="flex flex-col gap-6" id="student-panel-content">
                
                {/* Assignments Filter Heading Bar */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="font-bold text-slate-900 text-sm">Available Syllabus Coursework</h3>
                  <span className="text-xs text-slate-400 font-medium">
                    Select a card below to read prompt and submit your essay or project repository link.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="student-assignments-list">
                  {assignments.map(asg => {
                    // Find if there is an active submission from this student for this assignment
                    const studentId = supabaseMode ? sessionUser?.id : selectedStudent.id;
                    const submission = submissions.find(
                      s => s.assignment_id === asg.id && s.student_id === studentId
                    );

                    return (
                      <div 
                        key={asg.id} 
                        id={`student-asg-card-${asg.id}`}
                        onClick={() => setSelectedAssignment(asg)}
                        className={`bg-white border rounded-3xl p-5 md:p-6 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group relative duration-200 ${
                          selectedAssignment?.id === asg.id ? 'ring-2 ring-indigo-600 border-transparent' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                              {asg.points} points max
                            </span>
                            
                            {submission ? (
                              submission.status === 'graded' ? (
                                <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Graded
                                </span>
                              ) : (
                                <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Submitted
                                </span>
                              )
                            ) : (
                              <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Not Submitted
                              </span>
                            )}
                          </div>

                          <h4 className="font-extrabold text-slate-950 text-base leading-snug group-hover:text-indigo-600 transition">
                            {asg.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                            {asg.description}
                          </p>
                        </div>

                        {/* Grading Indicator Details or Actions Footer */}
                        <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-600 transition flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Due {asg.due_date}
                          </span>

                          <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition flex items-center gap-1">
                            {submission ? 'View Feedback' : 'Submit Work'}
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Student Assignment Details Drawer / Pane */}
                {selectedAssignment && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom duration-200" id="student-selected-assignment-details">
                    <div className="lg:col-span-2">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          Max Score: {selectedAssignment.points} PTS
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          Due Date: {selectedAssignment.due_date}
                        </span>
                      </div>

                      <h3 className="text-xl font-black text-slate-950">{selectedAssignment.title}</h3>
                      
                      <div className="mt-4 prose prose-slate max-w-none text-slate-600 text-sm leading-relaxed">
                        <p>{selectedAssignment.description}</p>
                      </div>

                      {/* Submit form directly inside details area */}
                      {(() => {
                        const studentId = supabaseMode ? sessionUser?.id : selectedStudent.id;
                        const sub = submissions.find(
                          s => s.assignment_id === selectedAssignment.id && s.student_id === studentId
                        );

                        if (sub) {
                          return (
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-150 mt-6" id="submission-preview-card">
                              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/50">
                                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                                  <FileText className="w-4 h-4 text-indigo-600" />
                                  Your Submitted Work
                                </h4>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                  sub.status === 'graded' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                                }`}>
                                  {sub.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-3.5 rounded-xl border border-slate-100">
                                "{sub.submission_text}"
                              </p>
                              {sub.attachment_url && (
                                <div className="mt-3 flex items-center justify-between">
                                  <a 
                                    href={sub.attachment_url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Project Repository Link
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          return (
                            <button
                              id="btn-open-submit-modal"
                              onClick={() => {
                                setSubmitText('');
                                setSubmitUrl('');
                                setShowSubmitModal(selectedAssignment);
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition shadow-md shadow-indigo-600/10 mt-6 flex items-center gap-1.5"
                            >
                              <FileText className="w-4 h-4" />
                              Submit Coursework Now
                            </button>
                          );
                        }
                      })()}
                    </div>

                    {/* Left Sidebar Grades feedback if submitted */}
                    <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 md:p-6 flex flex-col justify-between" id="assignment-feedback-sidebar">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Feedback & Performance</h4>
                        
                        {(() => {
                          const studentId = supabaseMode ? sessionUser?.id : selectedStudent.id;
                          const sub = submissions.find(
                            s => s.assignment_id === selectedAssignment.id && s.student_id === studentId
                          );

                          if (!sub) {
                            return (
                              <div className="text-center py-6 text-slate-400">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">No submission recorded yet for this task.</p>
                              </div>
                            );
                          }

                          if (sub.status === 'graded') {
                            return (
                              <div className="flex flex-col gap-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <Award className="w-6 h-6 animate-bounce" />
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Score Achieved</span>
                                    <span className="text-xl font-black text-emerald-600">
                                      {sub.grade} <span className="text-xs text-slate-400">/ {selectedAssignment.points} PTS</span>
                                    </span>
                                  </div>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider mb-1">Instructor Review</span>
                                  <p className="text-xs text-slate-600 leading-relaxed italic">
                                    "{sub.feedback || 'Excellent execution, criteria met perfectly.'}"
                                  </p>
                                  <span className="text-[9px] font-bold text-indigo-600 block mt-3 uppercase tracking-wider">
                                    - GRADED BY FACULTY
                                  </span>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center py-6">
                                <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2 animate-spin-slow" />
                                <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Awaiting Grading</h5>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                  Your coursework was submitted successfully. Your instructor will grade your paper and issue a report soon!
                                </p>
                              </div>
                            );
                          }
                        })()}
                      </div>

                      <button
                        id="btn-close-asg-details"
                        onClick={() => setSelectedAssignment(null)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 border-t border-slate-200 pt-3 mt-4 text-center block w-full"
                      >
                        Close Details Panel
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* MODAL: SUBMISSION FORM FOR STUDENTS */}
        {showSubmitModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" id="submit-work-modal-overlay">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200" id="submit-work-modal-content">
              
              <h3 className="text-lg font-bold text-slate-950 mb-1 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Submit Assignment Coursework
              </h3>
              <p className="text-xs text-slate-500 mb-5 font-semibold">
                {showSubmitModal.title}
              </p>

              <form onSubmit={handleSubmitWork} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Your Essay, Answer, or Technical Summary</label>
                  <textarea
                    id="submission-text-input"
                    required
                    rows={6}
                    placeholder="Enter the full text of your essay or response..."
                    value={submitText}
                    onChange={(e) => setSubmitText(e.target.value)}
                    className="border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Attachment URL (Optional)</label>
                  <input
                    id="submission-url-input"
                    type="url"
                    placeholder="e.g. https://github.com/myusername/project"
                    value={submitUrl}
                    onChange={(e) => setSubmitUrl(e.target.value)}
                    className="border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    id="submit-modal-cancel"
                    onClick={() => setShowSubmitModal(null)}
                    className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="submit-modal-confirm"
                    className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/10"
                  >
                    Submit Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: GRADING FORM FOR ADMINS */}
        {showGradeModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" id="grading-modal-overlay">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200" id="grading-modal-content">
              
              <h3 className="text-lg font-bold text-slate-950 mb-1 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                Grade Student Coursework
              </h3>
              <p className="text-xs text-indigo-600 mb-5 font-bold">
                Assessing: {assignments.find(a => a.id === showGradeModal.assignment_id)?.title}
              </p>

              {/* Student submission preview */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs text-slate-600 leading-relaxed max-h-40 overflow-y-auto mb-4 italic">
                "{showGradeModal.submission_text}"
              </div>

              <form onSubmit={handleGradeSubmission} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Score / Points (Max {assignments.find(a => a.id === showGradeModal.assignment_id)?.points || 100})
                  </label>
                  <input
                    id="grading-score-input"
                    type="number"
                    required
                    min={0}
                    max={assignments.find(a => a.id === showGradeModal.assignment_id)?.points || 100}
                    value={gradeScore}
                    onChange={(e) => setGradeScore(Number(e.target.value))}
                    className="border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Constructive Feedback</label>
                  <textarea
                    id="grading-feedback-input"
                    required
                    rows={4}
                    placeholder="Provide actionable feedback and rubric reviews..."
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    className="border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl px-4 py-2.5 outline-none text-sm transition"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    id="grading-modal-cancel"
                    onClick={() => setShowGradeModal(null)}
                    className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    id="grading-modal-confirm"
                    className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/10"
                  >
                    Submit Performance Grade
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* Clean Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4 md:px-8 mt-auto text-center text-xs text-slate-400 font-semibold" id="main-footer">
        Student-Admin Portal — Configured for Live Supabase Postgres with Row Level Security (RLS) policies.
      </footer>
    </div>
  );
}
