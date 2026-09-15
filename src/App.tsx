import { useState, useEffect } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import {
  IncomeStep,
  SavingsStep,
  ExpensesStep,
  DebtsStep,
  EmergencyStep,
  ReviewStep,
  DiagnosisStep,
} from './components/WizardSteps';
import { ImpulseTool, DebtSimulator, LongTermSimulator } from './components/Tools';
import { SelosPanel } from './components/SelosAndShare';
import { CheckInTool } from './components/CheckIn';
import { PrivacyPage, TermsPage, NotFoundPage } from './components/Pages';
import { INITIAL_DATA, WizardData } from './types';
import { calculateDiagnosis } from './calculations';

const STORAGE_KEY = 'selos-wizard-progress';

interface SavedProgress {
  data: WizardData;
  step: number;
}

function loadSavedProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProgress;
    // só considera "progresso salvo" se a pessoa realmente preencheu algo
    if (!parsed.data || parsed.data.monthlyIncome <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function App() {
  const [showWizard, setShowWizard] = useState(false);
  const [activeTool, setActiveTool] = useState<null | 'impulse' | 'debts' | 'selos' | 'checkin' | 'longterm'>(null);
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(() => loadSavedProgress());

  // salva a cada mudança, mas só depois que a pessoa começou a preencher de verdade
  useEffect(() => {
    if (data.monthlyIncome > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step }));
    }
  }, [data, step]);

  const update = (patch: Partial<WizardData>) => setData((prev) => ({ ...prev, ...patch }));
  const updateExpenses = (key: keyof WizardData['expenses'], value: number) =>
    setData((prev) => ({ ...prev, expenses: { ...prev.expenses, [key]: value } }));

  const onNext = () => setStep((s) => s + 1);
  const onBack = () => setStep((s) => Math.max(s - 1, 1));
  const goToStep = (s: number) => setStep(s);
  const startWizard = () => {
    setData(INITIAL_DATA);
    setStep(1);
    setShowWizard(true);
  };
  const resumeWizard = () => {
    if (!savedProgress) return;
    setData(savedProgress.data);
    setStep(savedProgress.step);
    setShowWizard(true);
  };
  const onRestart = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedProgress(null);
    setData(INITIAL_DATA);
    setStep(1);
    setShowWizard(false);
  };

  const stepProps = { data, update, updateExpenses, onNext, onBack, canNext: true };

  return (
    <>
      <style>{`
        :root{
          --sand:#F7EFDC;
          --sand-deep:#EFE3C4;
          --paper:#FBF6EC;
          --ink:#241A0F;
          --ink-soft:#6B5D42;
          --ink-faint:#94875F;
          --gold:#BD7E1E;
          --gold-bright:#DDA13B;
          --gold-deep:#7A5311;
          --clay:#9C4C2A;
          --hairline:#DCC996;
          --hairline-soft:#E9DBB4;
          --white:#FFFDF7;
          --lapis:#1C4F72;
        }
        *{margin:0;padding:0;box-sizing:border-box;}
        html{scroll-behavior:smooth;}
        body{
          background-color:#E9D9AC;
          background-image:
            radial-gradient(ellipse 60% 40% at 12% 8%, rgba(156,110,45,0.16), transparent 60%),
            radial-gradient(ellipse 50% 35% at 92% 18%, rgba(120,80,30,0.14), transparent 60%),
            radial-gradient(ellipse 70% 50% at 30% 92%, rgba(140,95,40,0.15), transparent 60%),
            radial-gradient(ellipse 55% 45% at 100% 100%, rgba(100,65,25,0.18), transparent 55%),
            radial-gradient(ellipse 120% 90% at 50% 45%, #F3E6BE, #E4D19E 70%, #D9C58C 100%),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.15  0 0 0 0 0.10  0 0 0 0 0.04  0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='%238A5A12' fill-opacity='0.05'%3E%3Cpath d='M6 30l6-4 2 8z'/%3E%3Cpath d='M40 12l6-4 2 8z'/%3E%3Cpath d='M22 46l6-4 2 8z'/%3E%3Cpath d='M52 40l6-4 2 8z'/%3E%3C/g%3E%3C/svg%3E");
          background-blend-mode:normal,normal,normal,normal,normal,overlay,normal;
          background-attachment:fixed;
          color:var(--ink);
          font-family:'EB Garamond',serif;
          line-height:1.65;
          -webkit-font-smoothing:antialiased;
          font-size:17.5px;
        }
        h1,h2,h3,.serif{font-family:'Cinzel',serif;letter-spacing:0.2px;}
        a{color:inherit;text-decoration:none;}
        img,svg{display:block;}
        .wrap{max-width:1180px;margin:0 auto;padding:0 40px;}
        @media (max-width:640px){.wrap{padding:0 22px;}}
        ::selection{background:var(--gold-bright);color:var(--ink);}

        .wedge{
          display:inline-block;width:6px;height:10px;
          background:var(--gold);
          clip-path:polygon(0 0,100% 30%,60% 100%,0 60%);
          margin-right:9px;flex-shrink:0;
        }

        header{
          position:sticky;top:0;z-index:30;
          background:rgba(247,239,220,0.86);
          backdrop-filter:blur(10px) saturate(1.1);
          border-bottom:1px solid var(--hairline-soft);
        }
        nav{display:flex;align-items:center;justify-content:space-between;padding:16px 40px;max-width:1180px;margin:0 auto;}
        .brand{display:flex;align-items:center;gap:10px;}
        .brand-mark{width:26px;height:26px;flex-shrink:0;}
        .logo{font-size:17px;font-weight:500;letter-spacing:0.5px;font-family:'Cinzel',serif;}
        .navlinks{display:flex;gap:38px;font-size:14px;color:var(--ink-soft);font-family:'IBM Plex Sans',sans-serif;}
        .navlinks a{position:relative;padding-bottom:2px;}
        .navlinks a::after{
          content:'';position:absolute;left:0;bottom:-4px;width:0;height:1px;background:var(--gold-deep);
          transition:width 0.25s ease;
        }
        .navlinks a:hover::after{width:100%;}
        .navlinks a:hover{color:var(--ink);}
        .nav-cta{
          background:var(--ink);color:var(--paper);
          padding:10px 19px;border-radius:6px;font-size:13.5px;font-weight:500;
          transition:background 0.2s ease;font-family:'IBM Plex Sans',sans-serif;
        }
        .nav-cta:hover{background:var(--gold-deep);}
        @media (max-width:840px){.navlinks{display:none;}}

        .hero{
          position:relative;
          padding:88px 40px 96px;
          max-width:1180px;margin:0 auto;
          display:grid;grid-template-columns:1.08fr 0.92fr;gap:24px;align-items:center;
        }
        @media (max-width:900px){
          .hero{grid-template-columns:1fr;padding:52px 22px 56px;gap:44px;}
        }
        .hero-copy{position:relative;z-index:2;}
        @keyframes rise{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        .hero-copy > *{opacity:0;animation:rise 0.7s cubic-bezier(.2,.7,.2,1) forwards;}
        .hero-copy .kicker{animation-delay:0.05s;}
        .hero-copy h1{animation-delay:0.18s;}
        .hero-copy .lede{animation-delay:0.32s;}
        .hero-copy .cta-row{animation-delay:0.46s;}
        .hero-copy .microcopy{animation-delay:0.58s;}
        .seal-frame{opacity:0;animation:rise 0.9s cubic-bezier(.2,.7,.2,1) forwards;animation-delay:0.3s;}

        .kicker{
          font-size:13.5px;color:var(--gold-deep);font-weight:500;margin-bottom:20px;
          display:flex;align-items:center;font-family:'IBM Plex Sans',sans-serif;
        }
        .hero h1{
          font-size:clamp(34px,5vw,58px);font-weight:500;line-height:1.06;letter-spacing:-0.8px;
          color:var(--ink);margin-bottom:26px;max-width:560px;
        }
        .hero p.lede{
          font-size:18px;color:var(--ink-soft);max-width:470px;margin-bottom:36px;
        }
        .hero p.lede i{font-style:italic;color:var(--ink);}
        .cta-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
        .btn-primary{
          background:linear-gradient(180deg,var(--gold-bright),var(--gold));
          color:#2E1C05;
          padding:15px 27px;border-radius:7px;font-size:15px;font-weight:600;
          font-family:'IBM Plex Sans',sans-serif;letter-spacing:0.2px;
          border:none;cursor:pointer;box-shadow:0 1px 0 rgba(255,255,255,0.35) inset,0 10px 22px -12px rgba(122,83,17,0.55);
          transition:transform 0.15s ease,box-shadow 0.15s ease;
        }
        .btn-primary:hover{transform:translateY(-1px);box-shadow:0 1px 0 rgba(255,255,255,0.4) inset,0 14px 26px -12px rgba(122,83,17,0.6);}
        .btn-outline{
          background:transparent;color:var(--ink);
          padding:14px 25px;border-radius:7px;font-size:15px;font-weight:500;
          font-family:'IBM Plex Sans',sans-serif;
          border:1px solid var(--hairline);cursor:pointer;transition:border-color 0.2s ease;
        }
        .btn-outline:hover{border-color:var(--ink);}
        .microcopy{font-size:13px;color:var(--ink-faint);margin-top:16px;font-family:'IBM Plex Sans',sans-serif;}
        .resume-banner{
          background:var(--sand-deep);border:1px solid var(--hairline);border-radius:8px;
          padding:14px 18px;margin-bottom:24px;font-family:'IBM Plex Sans',sans-serif;
        }
        .resume-banner span{display:block;font-size:14px;color:var(--ink-soft);margin-bottom:12px;}
        .resume-actions{display:flex;gap:10px;flex-wrap:wrap;}
        .resume-actions .btn-primary,.resume-actions .btn-outline{padding:10px 18px;font-size:13.5px;}

        .seal-frame{position:relative;display:flex;justify-content:center;}
        .medallion{width:min(360px,88%);filter:drop-shadow(0 26px 34px rgba(90,58,10,0.22));}
        @keyframes sweep{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        .sheen{animation:sweep 7s linear infinite;transform-origin:150px 150px;}
        @media (prefers-reduced-motion:reduce){.sheen{animation:none;}}

        .band{border-top:1px solid var(--hairline-soft);border-bottom:1px solid var(--hairline-soft);background:var(--sand-deep);}
        .band .wrap{display:grid;grid-template-columns:repeat(3,1fr);padding:34px 40px;}
        .band .stat{text-align:center;padding:0 16px;}
        .band .stat + .stat{border-left:1px solid var(--hairline);}
        .band .stat b{display:block;font-family:'Cinzel',serif;font-size:25px;font-weight:500;color:var(--ink);margin-bottom:3px;}
        .band .stat span{font-size:13px;color:var(--ink-soft);font-family:'IBM Plex Sans',sans-serif;}
        @media (max-width:640px){.band .wrap{grid-template-columns:1fr;gap:18px;padding:26px 22px;}
          .band .stat + .stat{border-left:none;border-top:1px solid var(--hairline);padding-top:16px;}}

        .principles{padding:110px 40px 100px;max-width:1180px;margin:0 auto;}
        @media (max-width:640px){.principles{padding:70px 22px 60px;}}
        .section-head{max-width:600px;margin-bottom:60px;}
        .section-head .kicker{margin-bottom:16px;}
        .section-head h2{font-size:clamp(26px,3.4vw,36px);font-weight:500;line-height:1.22;letter-spacing:-0.3px;}

        .frieze{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--hairline);border-radius:3px;overflow:hidden;background:var(--white);}
        @media (max-width:860px){.frieze{grid-template-columns:1fr;}}
        .panel{padding:44px 34px;position:relative;}
        .panel:not(:last-child){border-right:1px solid var(--hairline-soft);}
        @media (max-width:860px){.panel:not(:last-child){border-right:none;border-bottom:1px solid var(--hairline-soft);}}
        .panel::before{
          content:'';position:absolute;top:0;left:0;right:0;height:3px;
          background:repeating-linear-gradient(90deg,var(--gold) 0 8px,transparent 8px 16px);
          opacity:0.6;
        }
        .numeral{
          font-family:'Cinzel',serif;font-size:22px;color:var(--gold-deep);font-weight:500;
          margin-bottom:26px;
          text-shadow:0 1px 0 rgba(255,255,255,0.7),0 -1px 0 rgba(122,83,17,0.25);
        }
        .panel h3{font-size:19px;font-weight:500;margin-bottom:12px;letter-spacing:-0.1px;}
        .panel p{font-size:14.5px;color:var(--ink-soft);}

        .quote-section{background:var(--ink);padding:130px 40px;position:relative;overflow:hidden;}
        @media (max-width:640px){.quote-section{padding:88px 22px;}}
        .quote-section .wrap{max-width:780px;position:relative;z-index:2;}
        .quote-frame{border-top:1px solid rgba(221,161,59,0.35);border-bottom:1px solid rgba(221,161,59,0.35);padding:52px 0;text-align:center;}
        .dropcap{
          font-family:'Cinzel',serif;font-size:64px;color:var(--gold-bright);line-height:0.7;
          display:block;margin-bottom:6px;font-weight:500;
        }
        .quote-section blockquote{
          font-family:'EB Garamond',serif;font-style:italic;font-weight:400;
          font-size:clamp(21px,2.6vw,29px);line-height:1.42;color:var(--paper);
        }
        .quote-section cite{
          display:block;margin-top:26px;font-family:'IBM Plex Sans',sans-serif;
          font-style:normal;font-size:13.5px;color:#B9A57C;letter-spacing:0.2px;
        }
        .quote-seal{position:absolute;opacity:0.1;z-index:1;}
        .quote-seal.left{top:-60px;left:-60px;width:280px;}
        .quote-seal.right{bottom:-70px;right:-60px;width:320px;}

        .how{padding:110px 40px;max-width:1180px;margin:0 auto;}
        @media (max-width:640px){.how{padding:70px 22px;}}
        .path{position:relative;margin-top:20px;padding-left:6px;}
        .path::before{content:'';position:absolute;left:24px;top:8px;bottom:8px;width:1px;background:var(--hairline);}
        .path-step{position:relative;display:flex;gap:28px;padding:0 0 52px 0;}
        .path-step:last-child{padding-bottom:0;}
        .marker{
          width:49px;height:49px;border-radius:50%;background:var(--white);
          border:1px solid var(--hairline);flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          font-family:'Cinzel',serif;font-size:16px;color:var(--gold-deep);font-weight:500;
          position:relative;z-index:2;
        }
        .path-step-body{padding-top:8px;}
        .path-step h3{font-size:18px;font-weight:500;margin-bottom:8px;}
        .path-step p{font-size:14.5px;color:var(--ink-soft);max-width:460px;}

        .final-cta{padding:60px 40px 120px;max-width:1180px;margin:0 auto;}
        @media (max-width:640px){.final-cta{padding:20px 22px 80px;}}
        .cta-frame{
          position:relative;border:1px solid var(--hairline);padding:76px 40px;text-align:center;background:var(--white);
        }
        @media (max-width:640px){.cta-frame{padding:54px 22px;}}
        .corner{position:absolute;width:22px;height:22px;}
        .corner svg{width:100%;height:100%;}
        .corner.tl{top:-1px;left:-1px;}
        .corner.tr{top:-1px;right:-1px;transform:scaleX(-1);}
        .corner.bl{bottom:-1px;left:-1px;transform:scaleY(-1);}
        .corner.br{bottom:-1px;right:-1px;transform:scale(-1,-1);}
        .final-cta h2{font-size:clamp(26px,3.2vw,34px);font-weight:500;max-width:560px;margin:0 auto 16px;}
        .final-cta > .cta-frame > p{font-size:15.5px;color:var(--ink-soft);max-width:420px;margin:0 auto 34px;}

        footer{padding:0 40px 56px;max-width:1180px;margin:0 auto;}
        @media (max-width:640px){footer{padding:0 22px 40px;}}
        .foot-grid{display:grid;grid-template-columns:1.3fr 0.8fr 0.8fr 0.8fr;gap:32px;padding-top:56px;border-top:1px solid var(--hairline-soft);}
        @media (max-width:760px){.foot-grid{grid-template-columns:1fr;gap:28px;}}
        .foot-brand p{font-size:14px;color:var(--ink-soft);max-width:280px;margin-top:14px;}
        .foot-col h4{font-size:13px;color:var(--ink-faint);font-weight:500;margin-bottom:14px;letter-spacing:0.2px;font-family:'IBM Plex Sans',sans-serif;}
        .foot-col a{display:block;font-size:14px;color:var(--ink-soft);margin-bottom:10px;font-family:'IBM Plex Sans',sans-serif;}
        .foot-col a:hover{color:var(--ink);}
        .foot-bottom{margin-top:48px;font-size:12.5px;color:var(--ink-faint);font-family:'IBM Plex Sans',sans-serif;}

        /* ---------- wizard (Selos) ---------- */
        .wizard-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:60px 20px;}
        .wizard-card{width:100%;max-width:560px;background:var(--white);border:1px solid var(--hairline);border-radius:10px;padding:44px 38px;position:relative;}
        @media (max-width:640px){.wizard-card{padding:32px 22px;}}
        .wizard-progress{display:flex;gap:8px;margin-bottom:28px;}
        .wizard-dot{flex:1;height:4px;border-radius:2px;background:var(--hairline-soft);}
        .wizard-dot.done{background:var(--gold);}
        .wizard-dot.active{background:var(--gold-bright);}
        .wizard-kicker{font-size:13px;color:var(--gold-deep);font-family:'IBM Plex Sans',sans-serif;font-weight:500;margin-bottom:14px;display:flex;align-items:center;}
        .wizard-h2{font-size:26px;margin-bottom:8px;}
        .wizard-sub{font-size:14.5px;color:var(--ink-soft);margin-bottom:26px;}
        .selo-badge{display:inline-flex;align-items:center;gap:10px;background:var(--sand-deep);border:1px solid var(--hairline);border-radius:999px;padding:6px 16px 6px 6px;margin-bottom:20px;}
        .selo-badge .label{font-size:13px;color:var(--ink-soft);font-family:'IBM Plex Sans',sans-serif;font-weight:500;}
        .field-group{margin-bottom:18px;}
        .field-label{display:block;font-size:13.5px;color:var(--ink-soft);font-family:'IBM Plex Sans',sans-serif;margin-bottom:7px;}
        .field-input{width:100%;border:1px solid var(--hairline);border-radius:8px;padding:13px 16px;font-size:17px;font-family:'IBM Plex Sans',sans-serif;color:var(--ink);background:#FFFDF7;}
        .field-input:focus{outline:none;border-color:var(--gold);}
        .field-error{font-size:12.5px;color:var(--clay);margin-top:6px;}
        .debt-row{display:flex;gap:10px;margin-bottom:10px;align-items:center;}
        .debt-row .field-input{flex:1;}
        .debt-remove{border:1px solid var(--hairline);background:transparent;border-radius:8px;padding:0 14px;height:48px;color:var(--clay);cursor:pointer;font-family:'IBM Plex Sans',sans-serif;font-size:18px;}
        .add-debt{background:transparent;border:1px dashed var(--hairline);border-radius:8px;padding:12px;width:100%;color:var(--ink-soft);font-family:'IBM Plex Sans',sans-serif;font-size:14px;cursor:pointer;margin-top:4px;}
        .wizard-nav{display:flex;justify-content:space-between;align-items:center;margin-top:30px;}
        .wizard-nav .btn-primary:disabled{opacity:0.4;cursor:not-allowed;}
        .diag-section{margin-bottom:28px;}
        .diag-label{font-size:13px;color:var(--ink-faint);font-family:'IBM Plex Sans',sans-serif;margin-bottom:8px;}
        .diag-number{font-family:'Cinzel',serif;font-size:28px;color:var(--ink);margin-bottom:10px;}
        .bar-row{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
        .bar-row .bar-label{width:96px;font-size:13px;color:var(--ink-soft);font-family:'IBM Plex Sans',sans-serif;flex-shrink:0;}
        .bar-track{flex:1;height:10px;background:var(--sand-deep);border-radius:5px;overflow:hidden;position:relative;}
        .bar-fill{height:100%;background:var(--gold);border-radius:5px;}
        .bar-ideal-mark{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--lapis);}
        .progress-track{height:12px;background:var(--sand-deep);border-radius:6px;overflow:hidden;}
        .progress-fill{height:100%;background:linear-gradient(90deg,var(--gold-bright),var(--gold));}
        .action-list{margin-top:4px;}
        .action-item{display:flex;gap:14px;padding:14px 0;border-top:1px solid var(--hairline-soft);}
        .action-item:first-child{border-top:none;}
        .action-num{font-family:'Cinzel',serif;color:var(--gold-deep);font-size:16px;flex-shrink:0;width:24px;}
        .paywall{position:relative;}
        .paywall-teaser{position:relative;overflow:hidden;max-height:70px;margin-bottom:16px;}
        .paywall-fade{
          position:absolute;bottom:0;left:0;right:0;height:70px;
          background:linear-gradient(180deg,rgba(255,253,247,0) 0%,#FFFDF7 90%);
        }
        .selos-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:24px 0 8px;}
        .selo-tile{
          display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;
          background:#FFFDF7;border:1px solid var(--hairline);border-radius:10px;padding:20px 12px;
        }
        .selo-tile.locked{opacity:0.55;}
        .selo-tile-label{font-size:13px;color:var(--ink-soft);font-family:'IBM Plex Sans',sans-serif;}
        .tools-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;}
        .tools-grid .panel{border:1px solid var(--hairline);border-radius:8px;}
        .review-list{display:flex;flex-direction:column;gap:2px;margin-bottom:8px;}
        .review-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--hairline-soft);}
        .review-row:first-child{border-top:none;}
        .review-label{font-size:12.5px;color:var(--ink-faint);font-family:'IBM Plex Sans',sans-serif;margin-bottom:3px;}
        .review-value{font-family:'Cinzel',serif;font-size:16px;color:var(--ink);}
        .review-row .btn-outline{padding:8px 16px;font-size:13px;}
        .page-body p{margin-bottom:18px;color:var(--ink-soft);font-size:15.5px;}
        .page-body h3{font-size:18px;margin:32px 0 10px;color:var(--ink);}
        .page-body i{font-style:italic;}
        .btn-spinner{
          display:inline-block;width:14px;height:14px;border-radius:50%;
          border:2px solid rgba(46,28,5,0.3);border-top-color:#2E1C05;
          animation:spin 0.7s linear infinite;margin-right:8px;vertical-align:-2px;
        }
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>

      <Routes>
        <Route path="/" element={
      <>
      {!showWizard && !activeTool && (
      <>
      <header>
        <nav>
          <div className="brand">
            <svg className="brand-mark" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="#BD7E1E" />
              <circle cx="20" cy="20" r="18" fill="none" stroke="#7A5311" strokeWidth="1.5" />
              <path d="M11 26h18M13.5 21h13M16 16h8" stroke="#5A3A0A" strokeWidth="2.6" strokeLinecap="square" />
            </svg>
            <div className="logo">Grana Séria</div>
          </div>
          <div className="navlinks">
            <a href="#principios">Princípios</a>
            <a href="#ferramentas">Ferramentas</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#">Sobre</a>
          </div>
          <a href="#" className="nav-cta" onClick={(e) => { e.preventDefault(); startWizard(); }}>Fazer diagnóstico</a>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          {savedProgress && (
            <div className="resume-banner">
              <span>
                {savedProgress.step >= 7
                  ? 'Seu diagnóstico já está pronto.'
                  : `Encontramos um diagnóstico em andamento (etapa ${savedProgress.step} de 7).`}
              </span>
              <div className="resume-actions">
                <button className="btn-primary" onClick={resumeWizard} type="button">
                  {savedProgress.step >= 7 ? 'Ver diagnóstico' : 'Continuar'}
                </button>
                <button className="btn-outline" onClick={startWizard} type="button">Começar do zero</button>
              </div>
            </div>
          )}
          <div className="kicker"><span className="wedge"></span>Um diagnóstico para a vida real</div>
          <h1>Sua riqueza começa com um punhado de moedas guardadas com disciplina.</h1>
          <p className="lede">
            Clareza sobre o seu dinheiro e um plano de ação construído com os princípios de{' '}
            <i>O Homem Mais Rico da Babilônia</i> — sem planilha, sem jargão, sem enrolação.
          </p>
          <div className="cta-row">
            <button className="btn-primary" onClick={startWizard}>Fazer meu diagnóstico</button>
            <button className="btn-outline">Ver como funciona</button>
          </div>
          <p className="microcopy">Leva 10 minutos. O plano é seu, de graça.</p>
        </div>

        <div className="seal-frame">
          <svg className="medallion" viewBox="0 0 300 300">
            <defs>
              <radialGradient id="coinFace" cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor="#E8B45C" />
                <stop offset="55%" stopColor="#C6842A" />
                <stop offset="100%" stopColor="#93611A" />
              </radialGradient>
              <clipPath id="coinClip"><circle cx="150" cy="150" r="126" /></clipPath>
            </defs>

            <circle cx="150" cy="150" r="140" fill="none" stroke="#DCC996" strokeWidth="1" />
            <g>
              <circle cx="150" cy="150" r="130" fill="none" stroke="#7A5311" strokeWidth="10" strokeDasharray="2.2 5.6" />
            </g>
            <circle cx="150" cy="150" r="126" fill="url(#coinFace)" />
            <circle cx="150" cy="150" r="126" fill="none" stroke="#5A3A0A" strokeWidth="2" />
            <circle cx="150" cy="150" r="104" fill="none" stroke="#93611A" strokeWidth="1.4" />

            <g fill="#5A3A0A" clipPath="url(#coinClip)">
              <rect x="106" y="198" width="88" height="11" />
              <rect x="118" y="172" width="64" height="11" />
              <rect x="130" y="146" width="40" height="11" />
              <rect x="142" y="120" width="16" height="11" />
            </g>
            <circle cx="150" cy="88" r="9" fill="#5A3A0A" clipPath="url(#coinClip)" />
            <g stroke="#5A3A0A" strokeWidth="2.4" clipPath="url(#coinClip)">
              <line x1="150" y1="68" x2="150" y2="76" />
              <line x1="164" y1="74" x2="159" y2="80" />
              <line x1="136" y1="74" x2="141" y2="80" />
              <line x1="170" y1="88" x2="162" y2="88" />
              <line x1="130" y1="88" x2="138" y2="88" />
            </g>

            <g className="sheen" clipPath="url(#coinClip)">
              <ellipse cx="150" cy="150" rx="150" ry="34" fill="#FFF3D6" opacity="0.28" />
            </g>
          </svg>
        </div>
      </section>

      <div className="band">
        <div className="wrap">
          <div className="stat"><b>10%</b><span>guardado antes de qualquer gasto</span></div>
          <div className="stat"><b>3 leis</b><span>que sustentam o plano</span></div>
          <div className="stat"><b>10 min</b><span>para o diagnóstico completo</span></div>
        </div>
      </div>

      <section className="principles" id="principios">
        <div className="section-head">
          <div className="kicker"><span className="wedge"></span>Os sete remédios da bolsa</div>
          <h2>Três leis, escritas há cinco mil anos, ainda sustentam qualquer plano.</h2>
        </div>
        <div className="frieze">
          <div className="panel">
            <div className="numeral">I</div>
            <h3>Pague-se primeiro</h3>
            <p>Guarde uma parte de tudo o que você ganha antes de qualquer outra despesa. Não o que resta — o que você decide guardar.</p>
          </div>
          <div className="panel">
            <div className="numeral">II</div>
            <h3>Controle os gastos</h3>
            <p>O problema raramente é ganhar pouco. É não saber pra onde o dinheiro vai. Mapeie antes de cortar.</p>
          </div>
          <div className="panel">
            <div className="numeral">III</div>
            <h3>Proteja-se de perdas</h3>
            <p>Decisões financeiras de impulso custam mais do que economizam. Avalie o risco antes de comprometer o capital.</p>
          </div>
        </div>
      </section>

      <section className="quote-section">
        <svg className="quote-seal left" viewBox="0 0 300 300">
          <circle cx="150" cy="150" r="126" fill="none" stroke="#DDA13B" strokeWidth="2" />
          <circle cx="150" cy="150" r="104" fill="none" stroke="#DDA13B" strokeWidth="1" />
        </svg>
        <svg className="quote-seal right" viewBox="0 0 300 300">
          <circle cx="150" cy="150" r="126" fill="none" stroke="#DDA13B" strokeWidth="2" />
          <circle cx="150" cy="150" r="104" fill="none" stroke="#DDA13B" strokeWidth="1" />
        </svg>
        <div className="wrap">
          <div className="quote-frame">
            <span className="dropcap">"</span>
            <blockquote>A riqueza, como uma árvore, cresce de uma pequena semente. Quanto antes você a plantar, mais cedo a árvore crescerá.</blockquote>
            <cite>O Homem Mais Rico da Babilônia, George S. Clason</cite>
          </div>
        </div>
      </section>

      <section className="how" id="como-funciona">
        <div className="section-head">
          <div className="kicker"><span className="wedge"></span>Como funciona</div>
          <h2>Do diagnóstico ao plano, em três passos.</h2>
        </div>
        <div className="path">
          <div className="path-step">
            <div className="marker">01</div>
            <div className="path-step-body">
              <h3>Você responde</h3>
              <p>Perguntas objetivas sobre renda, gastos e hábitos — sem precisar abrir planilha nenhuma.</p>
            </div>
          </div>
          <div className="path-step">
            <div className="marker">02</div>
            <div className="path-step-body">
              <h3>A gente traduz</h3>
              <p>Seu diagnóstico é lido à luz das três leis, e vira um plano com passos claros para as próximas semanas.</p>
            </div>
          </div>
          <div className="path-step">
            <div className="marker">03</div>
            <div className="path-step-body">
              <h3>Você aplica</h3>
              <p>Um plano pra seguir, revisado a cada mês, com metas que fazem sentido pra sua realidade.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="principles" id="ferramentas">
        <div className="section-head">
          <div className="kicker"><span className="wedge" />Ferramentas</div>
          <h2>Além do diagnóstico, o que te ajuda no dia a dia.</h2>
        </div>
        <div className="tools-grid">
          <div className="panel" style={{ cursor: 'pointer' }} onClick={() => setActiveTool('impulse')}>
            <div className="numeral">$</div>
            <h3>Vale a pena comprar isso?</h3>
            <p>Antes de uma compra por impulso, veja o que ela custa em tempo de trabalho e na sua meta de poupança.</p>
          </div>
          <div className="panel" style={{ cursor: 'pointer' }} onClick={() => setActiveTool('debts')}>
            <div className="numeral">IV</div>
            <h3>Avalanche vs. bola de neve</h3>
            <p>Duas estratégias pra decidir qual dívida atacar primeiro, usando o que você já cadastrou no diagnóstico.</p>
          </div>
          <div className="panel" style={{ cursor: 'pointer' }} onClick={() => setActiveTool('selos')}>
            <div className="numeral">✦</div>
            <h3>Meus selos</h3>
            <p>Veja quais das quatro leis do livro você já desbloqueou ao completar o diagnóstico.</p>
          </div>
          <div className="panel" style={{ cursor: 'pointer' }} onClick={() => setActiveTool('checkin')}>
            <div className="numeral">↻</div>
            <h3>Check-in mensal</h3>
            <p>Registre seus números todo mês e acompanhe se a sua taxa de poupança está subindo.</p>
          </div>
          <div className="panel" style={{ cursor: 'pointer' }} onClick={() => setActiveTool('longterm')}>
            <div className="numeral">∞</div>
            <h3>Simulador de longo prazo</h3>
            <p>Ajuste aporte, taxa e prazo pra ver aonde sua poupança chega em 10, 20 ou 30 anos.</p>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-frame">
          <div className="corner tl"><svg viewBox="0 0 22 22"><path d="M1 21V1H21" fill="none" stroke="#BD7E1E" strokeWidth="2" /></svg></div>
          <div className="corner tr"><svg viewBox="0 0 22 22"><path d="M1 21V1H21" fill="none" stroke="#BD7E1E" strokeWidth="2" /></svg></div>
          <div className="corner bl"><svg viewBox="0 0 22 22"><path d="M1 21V1H21" fill="none" stroke="#BD7E1E" strokeWidth="2" /></svg></div>
          <div className="corner br"><svg viewBox="0 0 22 22"><path d="M1 21V1H21" fill="none" stroke="#BD7E1E" strokeWidth="2" /></svg></div>
          <h2>Pronto para guardar sua primeira moeda?</h2>
          <p>O diagnóstico é gratuito e leva menos tempo do que decidir o que comer no almoço.</p>
          <button className="btn-primary" onClick={startWizard}>Fazer meu diagnóstico</button>
        </div>
      </section>

      <footer>
        <div className="foot-grid">
          <div className="foot-brand">
            <div className="brand">
              <svg className="brand-mark" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="#BD7E1E" />
                <circle cx="20" cy="20" r="18" fill="none" stroke="#7A5311" strokeWidth="1.5" />
                <path d="M11 26h18M13.5 21h13M16 16h8" stroke="#5A3A0A" strokeWidth="2.6" strokeLinecap="square" />
              </svg>
              <div className="logo">Grana Séria</div>
            </div>
            <p>Um diagnóstico financeiro baseado nos princípios de O Homem Mais Rico da Babilônia.</p>
          </div>
          <div className="foot-col">
            <h4>Navegação</h4>
            <a href="#principios">Princípios</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#">Sobre</a>
          </div>
          <div className="foot-col">
            <h4>Comece</h4>
            <a href="#" onClick={(e) => { e.preventDefault(); startWizard(); }}>Fazer diagnóstico</a>
            <a href="#">Falar no WhatsApp</a>
          </div>
          <div className="foot-col">
            <h4>Legal</h4>
            <Link to="/politica-de-privacidade">Política de privacidade</Link>
            <Link to="/termos-de-uso">Termos de uso</Link>
          </div>
        </div>
        <p className="foot-bottom">
          Grana Séria — diagnóstico financeiro. Não somos uma consultoria financeira registrada; o conteúdo é
          educacional, baseado nos princípios do livro O Homem Mais Rico da Babilônia.
        </p>
      </footer>
      </>
      )}

      {showWizard && (
        <div className="wizard-wrap">
          {step === 1 && <IncomeStep {...stepProps} canNext={data.monthlyIncome > 0} />}
          {step === 2 && <SavingsStep {...stepProps} />}
          {step === 3 && <ExpensesStep {...stepProps} />}
          {step === 4 && <DebtsStep {...stepProps} />}
          {step === 5 && <EmergencyStep {...stepProps} />}
          {step === 6 && <ReviewStep {...stepProps} goToStep={goToStep} />}
          {step === 7 && (
            <DiagnosisStep data={data} diagnosis={calculateDiagnosis(data)} onRestart={onRestart} />
          )}
        </div>
      )}

      {activeTool === 'impulse' && (
        <ImpulseTool monthlyIncome={data.monthlyIncome} onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'debts' && (
        <DebtSimulator debts={data.debts} onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'selos' && (
        <SelosPanel onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'checkin' && (
        <CheckInTool onClose={() => setActiveTool(null)} />
      )}
      {activeTool === 'longterm' && (
        <LongTermSimulator monthlyIncome={data.monthlyIncome} onClose={() => setActiveTool(null)} />
      )}
      </>
        } />
        <Route path="/politica-de-privacidade" element={<PrivacyPage />} />
        <Route path="/termos-de-uso" element={<TermsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
