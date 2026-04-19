import { Link } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
import "../styles/landing.css";

const stats = [
  { value: "AHP", label: "의사결정 방법론", note: "Analytic Hierarchy Process" },
  { value: "CR ≤ 0.1", label: "일관성 검증", note: "Saaty 일관성 기준" },
  { value: "기하평균", label: "집계 방식", note: "다수 응답자 집계" },
];

const features = [
  { num: "01", title: "계층 구조 설계", desc: "목표 · 기준 · 대안" },
  { num: "02", title: "쌍대비교 설문", desc: "전문가 판단 수집" },
  { num: "03", title: "우선순위 도출", desc: "기하평균 · 일관성 검증" },
];

const LandingPage = () => (
  <div className="lp-root">
    <header className="lp-header">
      <Link to="/" className="lp-logo">
        <span className="lp-logo-sub">AHP Platform</span>
        <span className="lp-logo-main">의사결정 플랫폼</span>
      </Link>
      <nav className="lp-nav">
        <Link to="/participant" className="lp-nav-link">설문 참여</Link>
        <Link to="/admin" className="lp-nav-link lp-nav-link--cta">
          관리자 콘솔 <FiArrowRight size={11} />
        </Link>
      </nav>
    </header>

    <main>
      <section className="lp-hero">
        <div className="lp-hero-bg" aria-hidden>
          <div className="lp-hero-grid" />
          <div className="lp-hero-glow" />
        </div>
        <div className="lp-hero-inner">
          <span className="lp-eyebrow">AHP · Analytic Hierarchy Process</span>
          <h1 className="lp-title">
            의사결정의
            <em>새로운 기준</em>
          </h1>
          <div className="lp-rule" aria-hidden />
          <p className="lp-subtitle">복잡한 판단을 체계적 우선순위로</p>
          <div className="lp-cta-row">
            <Link to="/admin" className="lp-btn-primary">
              관리자 콘솔 <FiArrowRight size={13} />
            </Link>
            <Link to="/participant" className="lp-btn-ghost">설문 참여하기</Link>
          </div>
        </div>
      </section>

      <section className="lp-stats-section" aria-label="주요 지표">
        {stats.map((s) => (
          <div key={s.label} className="lp-stat">
            <span className="lp-stat-value">{s.value}</span>
            <span className="lp-stat-label">{s.label}</span>
            <span className="lp-stat-note">{s.note}</span>
          </div>
        ))}
      </section>

      <section className="lp-features" aria-label="주요 기능">
        {features.map((f) => (
          <div key={f.num} className="lp-feature">
            <span className="lp-feature-num">{f.num}</span>
            <span className="lp-feature-title">{f.title}</span>
            <span className="lp-feature-desc">{f.desc}</span>
            <div className="lp-feature-rule" aria-hidden />
          </div>
        ))}
      </section>
    </main>
  </div>
);

export default LandingPage;
