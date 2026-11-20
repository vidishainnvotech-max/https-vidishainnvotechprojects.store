import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, Gift, RefreshCw, Share2, ShoppingBag, Users } from "lucide-react";
import apiClient from "../api/client";
import StudentHeader from "../components/student/StudentHeader";
import { useToastOn } from "../components/Toast";

function StudentReferrals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useToastOn(error, "error", setError);

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get("/student/referrals");
      const payload = response?.data?.data ?? response?.data ?? {};

      setData({
        ...payload,
        summary: payload.summary ?? {},
        referral_code: payload.referral_code ?? null,
        referrals: Array.isArray(payload.referrals) ? payload.referrals : [],
        reward_coupons: Array.isArray(payload.reward_coupons)
          ? payload.reward_coupons
          : [],
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load referral information. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const copyReferralCode = async () => {
    const code = data?.referral_code?.code;

    if (!code || !data?.referral_code?.is_active) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copiedSuccessfully = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (!copiedSuccessfully) {
          throw new Error("Clipboard copy was not successful.");
        }
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Unable to copy automatically. Please select and copy the referral code manually.");
    }
  };

  const summary = data?.summary ?? {};
  const referrals = data?.referrals ?? [];
  const coupons = data?.reward_coupons ?? [];
  const threshold = Math.max(Number(summary.reward_threshold) || 5, 1);
  const qualified = Number(summary.qualified_referrals) || 0;
  const progress = Math.min((qualified / threshold) * 100, 100);

  const rewardPercent = summary.reward_discount_percent ?? 20;
  const remaining = Math.max(threshold - qualified, 0);
  const segs = Math.min(threshold, 10);
  const filledSegs =
    threshold <= 10 ? Math.min(qualified, threshold) : Math.round((progress / 100) * segs);

  const statItems = [
    { label: "Total referrals", value: summary.total_referrals ?? 0, icon: Users, tone: "blue" },
    { label: "Pending", value: summary.pending_referrals ?? 0, icon: Clock, tone: "amber" },
    { label: "Qualified", value: qualified, icon: CheckCircle2, tone: "green" },
    { label: "Reward coupons", value: coupons.length, icon: Gift, tone: "violet" },
  ];

  if (loading) {
    return (
      <div className="student-page">
        <StudentHeader />
        <main className="container sx-page sx-ref" aria-busy="true">
          <div className="skeleton sxr-skel sxr-skel--hero" />
          <div className="skeleton sxr-skel sxr-skel--code" />
          <div className="sxr-stats">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton sxr-skel sxr-skel--stat" />
            ))}
          </div>
          <div className="skeleton sxr-skel sxr-skel--panel" />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="student-page">
        <StudentHeader />
        <main className="container sx-page sx-ref">
          <div className="error-state" role="alert">
            <span className="error-state__icon">
              <AlertTriangle size={24} aria-hidden="true" />
            </span>
            <h3>We couldn't load your referrals</h3>
            <p>Check your connection and try again.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadReferrals}>
              <RefreshCw size={15} aria-hidden="true" /> Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="student-page">
      <StudentHeader />
      <main className="container sx-page sx-ref">
        <section className="sx-hero">
          <span className="sx-hero__eyebrow">User program</span>
          <h1>Referrals & Rewards</h1>
          <p>Invite other groups and earn rewards when their purchases qualify.</p>
        </section>

        <section className="sxr-code">
          <div className="sxr-code__info">
            <span className="sxr-code__icon">
              <Gift size={22} aria-hidden="true" />
            </span>
            <div>
              <h2>Your referral code</h2>
              <p>Share this code with another group during registration.</p>
            </div>
          </div>

          <div className="sxr-code__action">
            {data.referral_code?.code ? (
              <>
                <code className="sxr-code__value">{data.referral_code.code}</code>
                <button
                  type="button"
                  className={`sxr-copy${copied ? " is-copied" : ""}`}
                  onClick={copyReferralCode}
                  disabled={!data.referral_code.is_active}
                >
                  {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                  {copied ? "Copied" : "Copy code"}
                </button>
              </>
            ) : (
              <p className="sxr-warn">No referral code is available for your group.</p>
            )}
          </div>

          {data.referral_code && !data.referral_code.is_active && (
            <p className="sxr-warn sxr-code__warn">Your referral code is currently inactive.</p>
          )}

          <ol className="sxr-steps">
            <li>
              <span><Share2 size={16} aria-hidden="true" /></span>
              <div><b>Share</b><small>Send your code to another group</small></div>
            </li>
            <li>
              <span><ShoppingBag size={16} aria-hidden="true" /></span>
              <div><b>They purchase</b><small>Their group completes an eligible purchase</small></div>
            </li>
            <li>
              <span><Gift size={16} aria-hidden="true" /></span>
              <div><b>You earn</b><small>{rewardPercent}% discount after {threshold} qualified</small></div>
            </li>
          </ol>
        </section>

        <div className="sxr-stats">
          {statItems.map(({ label, value, icon: Icon, tone }, i) => (
            <article key={label} className={`sxr-stat sxr-stat--${tone}`} style={{ "--i": i }}>
              <span className="sxr-stat__icon"><Icon size={20} aria-hidden="true" /></span>
              <div>
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            </article>
          ))}
        </div>

        <section className="sxr-panel">
          <div className="sxr-panel__head">
            <div>
              <h2>Reward progress</h2>
              <p>Qualified referrals count after the referred group completes an eligible purchase.</p>
            </div>
            <strong className="sxr-reward__count">
              {qualified}<span> / {threshold}</span>
            </strong>
          </div>

          <div
            className="sxr-segs"
            role="progressbar"
            aria-label="Referral reward progress"
            aria-valuemin={0}
            aria-valuemax={threshold}
            aria-valuenow={Math.min(qualified, threshold)}
          >
            {Array.from({ length: segs }, (_, i) => (
              <span key={i} className={i < filledSegs ? "is-on" : ""} style={{ "--i": i }} />
            ))}
          </div>

          <div className="sxr-reward__foot">
            <span>
              {qualified >= threshold
                ? "Threshold reached. Check your reward coupons below."
                : `${remaining} more qualified referral${remaining === 1 ? "" : "s"} needed to unlock your reward.`}
            </span>
            <span className="sxr-reward__tag">
              <Gift size={14} aria-hidden="true" /> {rewardPercent}% discount reward
            </span>
          </div>
        </section>

        <div className="sxr-cols">
          <section className="sxr-panel">
            <div className="sxr-panel__head sxr-panel__head--row">
              <h2>Referral history</h2>
              <span className="sxr-count">{referrals.length}</span>
            </div>

            {referrals.length === 0 ? (
              <div className="sxr-empty">
                <span><Users size={22} aria-hidden="true" /></span>
                <h3>No referrals yet</h3>
                <p>Share your referral code to get started.</p>
              </div>
            ) : (
              <ul className="sxr-list">
                {referrals.map((referral, i) => {
                  const qualifiedRow = referral.status === "qualified";
                  return (
                    <li key={referral.id} className="sxr-item" style={{ "--i": i }}>
                      <span className="sxr-item__icon"><Users size={18} aria-hidden="true" /></span>
                      <div className="sxr-item__body">
                        <strong>
                          {referral.referred_group?.guide_name ||
                            referral.referred_group?.name ||
                            `Group #${referral.referred_group?.id ?? "—"}`}
                        </strong>
                        <small>
                          {referral.qualified_at
                            ? `Qualified on ${new Date(referral.qualified_at).toLocaleDateString()}`
                            : "Waiting for an eligible completed purchase"}
                        </small>
                      </div>
                      <span className={`sxr-pill sxr-pill--${qualifiedRow ? "ok" : "warn"}`}>
                        {qualifiedRow ? "Qualified" : "Pending"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="sxr-panel">
            <div className="sxr-panel__head sxr-panel__head--row">
              <h2>Your reward coupons</h2>
              <span className="sxr-count">{coupons.length}</span>
            </div>

            {coupons.length === 0 ? (
              <div className="sxr-empty">
                <span><Gift size={22} aria-hidden="true" /></span>
                <h3>No coupons yet</h3>
                <p>Reward coupons appear here once you reach {threshold} qualified referrals.</p>
              </div>
            ) : (
              <ul className="sxr-list">
                {coupons.map((coupon, i) => (
                  <li key={coupon.id} className="sxr-item" style={{ "--i": i }}>
                    <span className="sxr-item__icon"><Gift size={18} aria-hidden="true" /></span>
                    <div className="sxr-item__body">
                      <strong className="sxr-mono">{coupon.code}</strong>
                      <small>
                        {coupon.type === "percentage"
                          ? `${Number(coupon.value)}% discount`
                          : `₹${Number(coupon.value).toFixed(2)} discount`}
                        {" · "}Used {coupon.used_count ?? 0}
                        {coupon.max_uses != null ? ` / ${coupon.max_uses}` : ""}
                      </small>
                    </div>
                    <span className={`sxr-pill sxr-pill--${coupon.is_active ? "ok" : "warn"}`}>
                      {coupon.is_active ? "Active" : "Inactive"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default StudentReferrals;