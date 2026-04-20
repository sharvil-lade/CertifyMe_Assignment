import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./lib/api";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  learner: "Learner Management",
  verifier: "Verifier Management",
  collaborator: "Collaborator Management",
  opportunity: "Opportunity Management",
  reports: "Reports and Analytics",
};

const EMPTY_LOGIN = { email: "", password: "", captchaInput: "", rememberMe: false };
const EMPTY_SIGNUP = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  captchaInput: "",
};
const EMPTY_FORGOT = { email: "", captchaInput: "" };
const EMPTY_OPPORTUNITY = {
  id: "",
  name: "",
  duration: "",
  startDate: "",
  description: "",
  skillsText: "",
  category: "",
  futureOpportunities: "",
  maxApplicants: "",
  prerequisites: "",
};

function generateCaptchaCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 5; i += 1) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatStartDate(dateValue) {
  if (!dateValue) return "";
  const dt = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return dateValue;
  return dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function getStrength(password) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function getInitials(displayName) {
  const parts = (displayName || "Admin").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) || "A";
  const second = parts[1]?.charAt(0) || parts[0]?.charAt(1) || "D";
  return `${first}${second}`.toUpperCase();
}

export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [theme, setTheme] = useState("light");
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  const [captchas, setCaptchas] = useState({
    login: generateCaptchaCode(),
    signup: generateCaptchaCode(),
    forgot: generateCaptchaCode(),
  });

  const [loginForm, setLoginForm] = useState(EMPTY_LOGIN);
  const [signupForm, setSignupForm] = useState(EMPTY_SIGNUP);
  const [forgotForm, setForgotForm] = useState(EMPTY_FORGOT);

  const [loginErrors, setLoginErrors] = useState({});
  const [signupErrors, setSignupErrors] = useState({});
  const [forgotErrors, setForgotErrors] = useState({});

  const [opportunities, setOpportunities] = useState([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [opportunityModalOpen, setOpportunityModalOpen] = useState(false);
  const [opportunityForm, setOpportunityForm] = useState(EMPTY_OPPORTUNITY);
  const [opportunityDetailsOpen, setOpportunityDetailsOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);

  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const pageTitle = PAGE_TITLES[page] || "Dashboard";
  const strengthScore = getStrength(signupForm.password);
  const strengthLabel = ["", "Weak", "Medium", "Strong", "Very Strong"][strengthScore];

  function showToast(message) {
    setToastMessage(message);
    setToastVisible(true);
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToastVisible(false), 3000);
  }

  function refreshCaptcha(type) {
    setCaptchas((prev) => ({ ...prev, [type]: generateCaptchaCode() }));
  }

  function clearAuthErrors() {
    setLoginErrors({});
    setSignupErrors({});
    setForgotErrors({});
  }

  async function loadOpportunities(showLoad = false, force = false) {
    if (!authenticated && !force) return;
    if (showLoad) setOpportunitiesLoading(true);
    try {
      const data = await apiRequest("/opportunities");
      setOpportunities(data.opportunities || []);
    } catch (err) {
      if (err.status === 401) {
        setAuthenticated(false);
        setAdmin(null);
        setAuthView("login");
        showToast("Session expired. Please sign in again.");
        return;
      }
      showToast(err.message || "Unable to load opportunities.");
    } finally {
      if (showLoad) setOpportunitiesLoading(false);
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.body.style.alignItems = authenticated ? "stretch" : "center";
    return () => {
      document.body.style.alignItems = "center";
    };
  }, [authenticated]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setSearchOpen(false);
      setOpportunityModalOpen(false);
      setOpportunityDetailsOpen(false);
      setNotifOpen(false);
      setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    async function restoreSession() {
      try {
        const data = await apiRequest("/session");
        if (data.authenticated) {
          setAuthenticated(true);
          setAdmin(data.admin);
          setPage("dashboard");
          await loadOpportunities(true, true);
        } else {
          setAuthenticated(false);
          setAdmin(null);
        }
      } catch (_err) {
        setAuthenticated(false);
        setAdmin(null);
      } finally {
        setSessionLoading(false);
      }
    }
    restoreSession();
  }, []);

  useEffect(() => {
    if (authenticated && page === "opportunity") {
      loadOpportunities(true);
    }
  }, [authenticated, page]);

  const dashboardName = useMemo(() => {
    if (admin?.name) return admin.name;
    if (admin?.email) return admin.email.split("@")[0];
    return "Admin";
  }, [admin]);

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!loginForm.email || !isValidEmail(loginForm.email)) nextErrors.email = "Please enter a valid email address";
    if (!loginForm.password) nextErrors.password = "Please enter your password";
    if (!loginForm.captchaInput) nextErrors.captchaInput = "Please enter the captcha code";
    else if (loginForm.captchaInput !== captchas.login) nextErrors.captchaInput = "Captcha does not match. Please try again.";

    if (Object.keys(nextErrors).length) {
      setLoginErrors(nextErrors);
      if (nextErrors.captchaInput) refreshCaptcha("login");
      return;
    }

    try {
      const data = await apiRequest("/login", {
        method: "POST",
        body: {
          email: loginForm.email.trim(),
          password: loginForm.password,
          rememberMe: loginForm.rememberMe,
        },
      });
      setAuthenticated(true);
      setAdmin(data.admin);
      setPage("dashboard");
      setLoginForm(EMPTY_LOGIN);
      clearAuthErrors();
      refreshCaptcha("login");
      await loadOpportunities(true, true);
      showToast("Login successful!");
    } catch (err) {
      setLoginErrors({ password: err.message || "Invalid email or password." });
      refreshCaptcha("login");
    }
  }

  async function handleSignupSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!signupForm.name.trim()) nextErrors.name = "Please enter your full name";
    if (!signupForm.email || !isValidEmail(signupForm.email)) nextErrors.email = "Please enter a valid email address";
    if (!signupForm.password || signupForm.password.length < 8) nextErrors.password = "Password must be at least 8 characters";
    if (!signupForm.confirmPassword || signupForm.confirmPassword !== signupForm.password) {
      nextErrors.confirmPassword = "Passwords do not match";
    }
    if (!signupForm.captchaInput) nextErrors.captchaInput = "Please enter the captcha code";
    else if (signupForm.captchaInput !== captchas.signup) nextErrors.captchaInput = "Captcha does not match";

    if (Object.keys(nextErrors).length) {
      setSignupErrors(nextErrors);
      if (nextErrors.captchaInput) refreshCaptcha("signup");
      return;
    }

    try {
      await apiRequest("/signup", {
        method: "POST",
        body: {
          name: signupForm.name.trim(),
          email: signupForm.email.trim(),
          password: signupForm.password,
          confirmPassword: signupForm.confirmPassword,
        },
      });
      setSignupForm(EMPTY_SIGNUP);
      setSignupErrors({});
      refreshCaptcha("signup");
      showToast("Account created successfully!");
      setAuthView("login");
    } catch (err) {
      setSignupErrors(err.errors || { generic: err.message || "Unable to create account." });
    }
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!forgotForm.email || !isValidEmail(forgotForm.email)) nextErrors.email = "Please enter a valid email address";
    if (!forgotForm.captchaInput) nextErrors.captchaInput = "Please enter the captcha code";
    else if (forgotForm.captchaInput !== captchas.forgot) nextErrors.captchaInput = "Captcha does not match";

    if (Object.keys(nextErrors).length) {
      setForgotErrors(nextErrors);
      if (nextErrors.captchaInput) refreshCaptcha("forgot");
      return;
    }

    try {
      const data = await apiRequest("/forgot-password", {
        method: "POST",
        body: { email: forgotForm.email.trim() },
      });
      showToast(data.message || "If the email exists, a reset link has been generated.");
      setForgotForm(EMPTY_FORGOT);
      setForgotErrors({});
      refreshCaptcha("forgot");
      setAuthView("login");
    } catch (err) {
      showToast(err.message || "Unable to process request.");
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/logout", { method: "POST" });
    } catch (_err) {
      // Ignore and proceed with local cleanup.
    }
    setAuthenticated(false);
    setAdmin(null);
    setPage("dashboard");
    setAuthView("login");
    setOpportunities([]);
    setOpportunityDetailsOpen(false);
    setOpportunityModalOpen(false);
    showToast("Signed out successfully");
  }

  function openAddOpportunityModal() {
    setOpportunityForm(EMPTY_OPPORTUNITY);
    setOpportunityModalOpen(true);
  }

  function openEditOpportunityModal() {
    if (!selectedOpportunity) return;
    setOpportunityForm({
      id: selectedOpportunity.id,
      name: selectedOpportunity.name || "",
      duration: selectedOpportunity.duration || "",
      startDate: selectedOpportunity.startDate || "",
      description: selectedOpportunity.description || "",
      skillsText: (selectedOpportunity.skills || []).join(", "),
      category: selectedOpportunity.category || "",
      futureOpportunities: selectedOpportunity.futureOpportunities || "",
      maxApplicants: selectedOpportunity.maxApplicants ?? "",
      prerequisites: selectedOpportunity.prerequisites || "",
    });
    setOpportunityDetailsOpen(false);
    setOpportunityModalOpen(true);
  }

  async function openOpportunityDetails(id) {
    try {
      const data = await apiRequest(`/opportunities/${id}`);
      setSelectedOpportunity(data.opportunity);
      setOpportunityDetailsOpen(true);
    } catch (err) {
      showToast(err.message || "Unable to load opportunity details.");
    }
  }

  async function handleOpportunitySubmit(event) {
    event.preventDefault();
    const skills = opportunityForm.skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (
      !opportunityForm.name.trim() ||
      !opportunityForm.duration.trim() ||
      !opportunityForm.startDate ||
      !opportunityForm.description.trim() ||
      !skills.length ||
      !opportunityForm.category ||
      !opportunityForm.futureOpportunities.trim()
    ) {
      showToast("Please fill all required fields.");
      return;
    }

    const payload = {
      name: opportunityForm.name.trim(),
      duration: opportunityForm.duration.trim(),
      startDate: opportunityForm.startDate,
      description: opportunityForm.description.trim(),
      skills,
      category: opportunityForm.category,
      futureOpportunities: opportunityForm.futureOpportunities.trim(),
      maxApplicants:
        opportunityForm.maxApplicants === "" ? null : Number(opportunityForm.maxApplicants),
      prerequisites: opportunityForm.prerequisites.trim(),
    };

    const isEditing = Boolean(opportunityForm.id);
    const endpoint = isEditing ? `/opportunities/${opportunityForm.id}` : "/opportunities";
    const method = isEditing ? "PUT" : "POST";

    try {
      await apiRequest(endpoint, { method, body: payload });
      setOpportunityModalOpen(false);
      setOpportunityForm(EMPTY_OPPORTUNITY);
      await loadOpportunities(true);
      showToast(isEditing ? "Opportunity updated successfully." : "Opportunity created successfully.");
    } catch (err) {
      showToast(err.message || "Unable to save opportunity.");
    }
  }

  async function handleDeleteOpportunity() {
    if (!selectedOpportunity) return;
    const confirmed = window.confirm("Delete this opportunity permanently?");
    if (!confirmed) return;
    try {
      await apiRequest(`/opportunities/${selectedOpportunity.id}`, { method: "DELETE" });
      setOpportunityDetailsOpen(false);
      setSelectedOpportunity(null);
      await loadOpportunities(true);
      showToast("Opportunity deleted successfully.");
    } catch (err) {
      showToast(err.message || "Unable to delete opportunity.");
    }
  }

  if (sessionLoading) {
    return (
      <div className="auth-wrapper">
        <div className="auth-container">
          <div className="form-panel">
            <h2 style={{ fontFamily: "Playfair Display, serif" }}>Loading...</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`toast ${toastVisible ? "show" : ""}`} id="toast">
        <span id="toastMsg">{toastMessage}</span>
      </div>

      <div className={`search-container ${searchOpen ? "active" : ""}`} onClick={() => setSearchOpen(false)}>
        <div className="search-box" onClick={(event) => event.stopPropagation()}>
          <div className="search-input-wrap">
            <input
              type="text"
              placeholder="Search students, courses, analytics..."
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            <button className="search-close" onClick={() => setSearchOpen(false)} type="button" aria-label="Close search">
              {"\u00D7"}
            </button>
          </div>
        </div>
      </div>

      <div className="auth-wrapper" style={{ display: authenticated ? "none" : "flex" }}>
        <div className="auth-container">
          <div className="brand-panel">
            <div className="brand-content">
              <h1>Universal Skills Passport</h1>
              <p>
                Manage and oversee the institutional skills tracking system with comprehensive admin controls.
              </p>
            </div>
          </div>

          <div className="form-panel">
            {authView === "login" && (
              <div className="form-page active">
                <div className="form-header">
                  <div className="badge">Admin Login</div>
                  <h2>Admin Portal</h2>
                  <p>Sign in to access the administrative dashboard</p>
                </div>
                <form id="loginForm" onSubmit={handleLoginSubmit} noValidate>
                  <div className="form-group">
                    <label>Email Address <span className="required">*</span></label>
                    <div className="input-wrap">
                      <input
                        type="email"
                        placeholder="admin@qf.org.qa"
                        className={loginErrors.email ? "error" : ""}
                        value={loginForm.email}
                        onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className={`error-msg ${loginErrors.email ? "show" : ""}`}><span>{loginErrors.email}</span></div>
                  </div>

                  <div className="form-group">
                    <label>Password <span className="required">*</span></label>
                    <div className="input-wrap">
                      <input
                        type="password"
                        placeholder="Enter your password"
                        className={loginErrors.password ? "error" : ""}
                        value={loginForm.password}
                        onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                    <div className={`error-msg ${loginErrors.password ? "show" : ""}`}><span>{loginErrors.password}</span></div>
                  </div>

                  <div className="form-group">
                    <label>Captcha <span className="required">*</span></label>
                    <div className="captcha-row">
                      <div className="captcha-display">
                        <span className="captcha-text">{captchas.login}</span>
                        <button type="button" className="captcha-refresh" onClick={() => refreshCaptcha("login")}>
                          {"\u21BB"}
                        </button>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div className="input-wrap">
                          <input
                            type="text"
                            placeholder="Enter captcha"
                            value={loginForm.captchaInput}
                            onChange={(e) => setLoginForm((prev) => ({ ...prev, captchaInput: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                    <div className={`error-msg ${loginErrors.captchaInput ? "show" : ""}`}><span>{loginErrors.captchaInput}</span></div>
                  </div>

                  <div className="form-options">
                    <label className="remember-me">
                      <input
                        type="checkbox"
                        checked={loginForm.rememberMe}
                        onChange={(e) => setLoginForm((prev) => ({ ...prev, rememberMe: e.target.checked }))}
                      />
                      <span className="checkmark"></span>
                      <span>Remember me</span>
                    </label>
                    <button type="button" className="link-btn" onClick={() => setAuthView("forgot")}>Forgot password?</button>
                  </div>
                  <button type="submit" className="btn-primary">Sign In</button>
                </form>
                <div className="form-footer">
                  Don't have an account?{" "}
                  <button type="button" className="link-btn" onClick={() => setAuthView("signup")}>
                    Create Account
                  </button>
                </div>
              </div>
            )}

            {authView === "signup" && (
              <div className="form-page active">
                <button type="button" className="back-to-login" onClick={() => setAuthView("login")}>Back to Login</button>
                <div className="form-header">
                  <div className="badge">New Admin</div>
                  <h2>Create Admin Account</h2>
                  <p>Register for administrative access</p>
                </div>
                <form id="signupForm" onSubmit={handleSignupSubmit} noValidate>
                  <div className="form-group">
                    <label>Full Name <span className="required">*</span></label>
                    <div className="input-wrap">
                      <input
                        type="text"
                        placeholder="Enter your full name"
                        className={signupErrors.name ? "error" : ""}
                        value={signupForm.name}
                        onChange={(e) => setSignupForm((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className={`error-msg ${signupErrors.name ? "show" : ""}`}><span>{signupErrors.name}</span></div>
                  </div>

                  <div className="form-group">
                    <label>Email Address <span className="required">*</span></label>
                    <div className="input-wrap">
                      <input
                        type="email"
                        placeholder="admin@qf.org.qa"
                        className={signupErrors.email ? "error" : ""}
                        value={signupForm.email}
                        onChange={(e) => setSignupForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className={`error-msg ${signupErrors.email ? "show" : ""}`}><span>{signupErrors.email}</span></div>
                  </div>

                  <div className="form-group">
                    <label>Password <span className="required">*</span></label>
                    <div className="input-wrap">
                      <input
                        type="password"
                        placeholder="Min 8 characters"
                        className={signupErrors.password ? "error" : ""}
                        value={signupForm.password}
                        onChange={(e) => setSignupForm((prev) => ({ ...prev, password: e.target.value }))}
                      />
                    </div>
                    <div className="password-strength">
                      <div className={`strength-bar ${strengthScore >= 1 ? "weak" : ""}`}></div>
                      <div className={`strength-bar ${strengthScore >= 2 ? "medium" : ""}`}></div>
                      <div className={`strength-bar ${strengthScore >= 3 ? "strong" : ""}`}></div>
                      <div className={`strength-bar ${strengthScore >= 4 ? "very-strong" : ""}`}></div>
                    </div>
                    <div className="strength-label">{signupForm.password ? strengthLabel : ""}</div>
                    <div className={`error-msg ${signupErrors.password ? "show" : ""}`}><span>{signupErrors.password}</span></div>
                  </div>

                  <div className="form-group">
                    <label>Confirm Password <span className="required">*</span></label>
                    <div className="input-wrap">
                      <input
                        type="password"
                        placeholder="Re-enter your password"
                        className={signupErrors.confirmPassword ? "error" : ""}
                        value={signupForm.confirmPassword}
                        onChange={(e) => setSignupForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      />
                    </div>
                    <div className={`error-msg ${signupErrors.confirmPassword ? "show" : ""}`}><span>{signupErrors.confirmPassword}</span></div>
                  </div>

                  <div className="form-group">
                    <label>Captcha <span className="required">*</span></label>
                    <div className="captcha-row">
                      <div className="captcha-display">
                        <span className="captcha-text">{captchas.signup}</span>
                        <button type="button" className="captcha-refresh" onClick={() => refreshCaptcha("signup")}>
                          {"\u21BB"}
                        </button>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div className="input-wrap">
                          <input
                            type="text"
                            placeholder="Enter captcha"
                            value={signupForm.captchaInput}
                            onChange={(e) => setSignupForm((prev) => ({ ...prev, captchaInput: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                    <div className={`error-msg ${signupErrors.captchaInput ? "show" : ""}`}><span>{signupErrors.captchaInput}</span></div>
                  </div>

                  {signupErrors.generic && <div className="error-msg show"><span>{signupErrors.generic}</span></div>}
                  <button type="submit" className="btn-primary">Create Account</button>
                </form>
                <div className="form-footer">
                  Already have an account?{" "}
                  <button type="button" className="link-btn" onClick={() => setAuthView("login")}>
                    Sign In
                  </button>
                </div>
              </div>
            )}

            {authView === "forgot" && (
              <div className="form-page active">
                <button type="button" className="back-to-login" onClick={() => setAuthView("login")}>Back to Login</button>
                <div className="form-header">
                  <div className="badge">Account Recovery</div>
                  <h2>Reset Password</h2>
                  <p>Enter your registered email and we'll send you a reset link</p>
                </div>
                <form id="forgotForm" onSubmit={handleForgotSubmit} noValidate>
                  <div className="form-group">
                    <label>Email Address <span className="required">*</span></label>
                    <div className="input-wrap">
                      <input
                        type="email"
                        placeholder="admin@qf.org.qa"
                        className={forgotErrors.email ? "error" : ""}
                        value={forgotForm.email}
                        onChange={(e) => setForgotForm((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className={`error-msg ${forgotErrors.email ? "show" : ""}`}><span>{forgotErrors.email}</span></div>
                  </div>

                  <div className="form-group">
                    <label>Captcha <span className="required">*</span></label>
                    <div className="captcha-row">
                      <div className="captcha-display">
                        <span className="captcha-text">{captchas.forgot}</span>
                        <button type="button" className="captcha-refresh" onClick={() => refreshCaptcha("forgot")}>
                          {"\u21BB"}
                        </button>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div className="input-wrap">
                          <input
                            type="text"
                            placeholder="Enter captcha"
                            value={forgotForm.captchaInput}
                            onChange={(e) => setForgotForm((prev) => ({ ...prev, captchaInput: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                    <div className={`error-msg ${forgotErrors.captchaInput ? "show" : ""}`}><span>{forgotErrors.captchaInput}</span></div>
                  </div>

                  <button type="submit" className="btn-primary">Send Reset Link</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`dashboard-wrapper ${authenticated ? "active" : ""}`}>
        <nav className={`sidebar ${sidebarOpen ? "open" : ""}`} id="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo-text">
              <span>Qatar Foundation</span>
              <span>Admin Portal</span>
            </div>
          </div>

          <div className="sidebar-profile">
            <div className="profile-avatar">{getInitials(dashboardName)}</div>
            <div className="profile-info">
              <div className="profile-name">{dashboardName}</div>
              <div className="profile-role">Business Administrator</div>
            </div>
          </div>

          <div className="sidebar-nav">
            <div className="nav-label">Main Menu</div>
            {Object.keys(PAGE_TITLES).map((key) => (
              <button
                key={key}
                className={`nav-item ${page === key ? "active" : ""}`}
                onClick={() => {
                  setPage(key);
                  setSidebarOpen(false);
                }}
              >
                {PAGE_TITLES[key]}
              </button>
            ))}
          </div>
          <div className="sidebar-footer">
            <button className="nav-item logout" onClick={handleLogout}>Logout</button>
          </div>
        </nav>

        <div className="dash-main">
          <div className="topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="topbar-btn" onClick={() => setSidebarOpen((prev) => !prev)} id="menuToggle" aria-label="Toggle menu">
                <span className="icon-glyph">{"\u2630"}</span>
              </button>
              <h2 id="pageTitle">{pageTitle}</h2>
            </div>
            <div className="topbar-actions">
              <button className="topbar-btn" onClick={() => setSearchOpen(true)} aria-label="Open search">
                <span className="icon-glyph">{"\u2315"}</span>
              </button>
              <button
                className="topbar-btn"
                onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                aria-label="Toggle theme"
              >
                <span className="icon-glyph">{theme === "dark" ? "\u2600" : "\u263E"}</span>
              </button>
              <button className="topbar-btn" onClick={() => setNotifOpen((prev) => !prev)} aria-label="Toggle notifications">
                <span className="icon-glyph">{"\uD83D\uDD14"}</span>
                <span className="notif-badge">3</span>
              </button>
              <div className={`notification-dropdown ${notifOpen ? "active" : ""}`}>
                <div className="notification-header">
                  <h4>Notifications</h4>
                </div>
                <div className="notif-item unread">2 new learner registrations</div>
                <div className="notif-item unread">1 opportunity is ending soon</div>
                <div className="notif-item">Daily report generated</div>
              </div>
            </div>
          </div>

          <div className="dash-content">
            <div className={`dash-section ${page === "dashboard" ? "active" : ""}`} id="dashboardSection">
              <div className="stats-row">
                <div className="stat-card"><div className="stat-value">1,248</div><h4>Total Learners</h4></div>
                <div className="stat-card"><div className="stat-value">312</div><h4>Certified</h4></div>
                <div className="stat-card"><div className="stat-value">89</div><h4>Active Verifiers</h4></div>
                <div className="stat-card"><div className="stat-value">{opportunities.length}</div><h4>Opportunities</h4></div>
              </div>
            </div>

            <div className={`dash-section ${page === "learner" ? "active" : ""}`} id="learnerSection">
              <div className="students-table-card">
                <h4>Learner Management</h4>
                <p>Static placeholder section retained from previous UI. Auth and Opportunity modules are dynamic.</p>
              </div>
            </div>

            <div className={`dash-section ${page === "verifier" ? "active" : ""}`} id="verifierSection">
              <div className="students-table-card">
                <h4>Verifier Management</h4>
                <p>Static placeholder section retained from previous UI. Auth and Opportunity modules are dynamic.</p>
              </div>
            </div>

            <div className={`dash-section ${page === "collaborator" ? "active" : ""}`} id="collaboratorSection">
              <div className="students-table-card">
                <h4>Collaborator Management</h4>
                <p>Static placeholder section retained from previous UI. Auth and Opportunity modules are dynamic.</p>
              </div>
            </div>

            <div className={`dash-section ${page === "opportunity" ? "active" : ""}`} id="opportunitySection">
              <div className="opportunity-header">
                <h4 style={{ fontFamily: "Playfair Display, serif", fontSize: 22, fontWeight: 600 }}>Opportunities & Certifications</h4>
                <button className="add-opportunity-btn" onClick={openAddOpportunityModal}>Add New Opportunity</button>
              </div>

              <div className="opportunities-grid" id="opportunitiesGrid">
                {opportunitiesLoading && (
                  <div className="opportunity-card">
                    <h5>Loading opportunities...</h5>
                  </div>
                )}
                {!opportunitiesLoading && opportunities.length === 0 && (
                  <div className="opportunity-card">
                    <h5>No opportunities yet</h5>
                    <p className="opportunity-description">
                      Create your first opportunity using the "Add New Opportunity" button.
                    </p>
                  </div>
                )}
                {!opportunitiesLoading &&
                  opportunities.map((item) => (
                    <div className="opportunity-card" key={item.id}>
                      <div className="opportunity-card-header">
                        <h5>{item.name}</h5>
                        <div className="opportunity-meta">
                          <span>{item.duration}</span>
                          <span>{formatStartDate(item.startDate)}</span>
                        </div>
                      </div>
                      <p className="opportunity-description">{item.description}</p>
                      <div className="opportunity-skills">
                        <div className="opportunity-skills-label">Skills You'll Gain</div>
                        <div className="skills-tags">
                          {(item.skills || []).map((skill) => (
                            <span className="skill-tag" key={`${item.id}-${skill}`}>{skill}</span>
                          ))}
                        </div>
                      </div>
                      <div className="opportunity-footer">
                        <span className="applicants-count">
                          {item.maxApplicants != null ? `${item.maxApplicants} max applicants` : "No max applicants"}
                        </span>
                        <button
                          className="view-course-btn"
                          style={{ width: "auto", padding: "8px 16px" }}
                          onClick={() => openOpportunityDetails(item.id)}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className={`dash-section ${page === "reports" ? "active" : ""}`} id="reportsSection">
              <div className="students-table-card">
                <h4>Reports & Analytics</h4>
                <p>Static placeholder section retained from previous UI. Auth and Opportunity modules are dynamic.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`modal ${opportunityDetailsOpen ? "active" : ""}`} onClick={() => setOpportunityDetailsOpen(false)}>
        <div className="modal-content" style={{ maxWidth: 600 }} onClick={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <h3>{selectedOpportunity?.name || "Opportunity Details"}</h3>
            <button className="close-modal" onClick={() => setOpportunityDetailsOpen(false)} aria-label="Close details modal">
              {"\u00D7"}
            </button>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ background: "var(--qf-mint-pale)", padding: "10px 16px", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "var(--qf-text-light)", display: "block" }}>Duration</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--qf-text)" }}>{selectedOpportunity?.duration || "-"}</span>
              </div>
              <div style={{ background: "var(--qf-mint-pale)", padding: "10px 16px", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "var(--qf-text-light)", display: "block" }}>Start Date</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--qf-text)" }}>{formatStartDate(selectedOpportunity?.startDate)}</span>
              </div>
              <div style={{ background: "var(--qf-mint-pale)", padding: "10px 16px", borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "var(--qf-text-light)", display: "block" }}>Applicants</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: "var(--qf-text)" }}>{selectedOpportunity?.maxApplicants ?? "N/A"}</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h5 style={{ fontSize: 14, fontWeight: 600, color: "var(--qf-text)", marginBottom: 8 }}>Description</h5>
              <p style={{ fontSize: 13, color: "var(--qf-text)", lineHeight: 1.6 }}>{selectedOpportunity?.description || ""}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h5 style={{ fontSize: 14, fontWeight: 600, color: "var(--qf-text)", marginBottom: 8 }}>Skills You'll Gain</h5>
              <div className="skills-tags">
                {(selectedOpportunity?.skills || []).map((skill) => (
                  <span className="skill-tag" key={`detail-${skill}`}>{skill}</span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h5 style={{ fontSize: 14, fontWeight: 600, color: "var(--qf-text)", marginBottom: 8 }}>Future Opportunities</h5>
              <p style={{ fontSize: 13, color: "var(--qf-text)", lineHeight: 1.6 }}>{selectedOpportunity?.futureOpportunities || ""}</p>
            </div>

            <div>
              <h5 style={{ fontSize: 14, fontWeight: 600, color: "var(--qf-text)", marginBottom: 8 }}>Prerequisites</h5>
              <p style={{ fontSize: 13, color: "var(--qf-text)", lineHeight: 1.6 }}>{selectedOpportunity?.prerequisites || "None"}</p>
            </div>
          </div>
          <div className="modal-actions">
            <button className="modal-action-btn approve" onClick={openEditOpportunityModal}>Edit</button>
            <button className="modal-action-btn reject" onClick={handleDeleteOpportunity}>Delete</button>
            <button className="modal-action-btn reject" onClick={() => setOpportunityDetailsOpen(false)}>Close</button>
          </div>
        </div>
      </div>

      <div className={`modal ${opportunityModalOpen ? "active" : ""}`} onClick={() => setOpportunityModalOpen(false)}>
        <div className="modal-content" onClick={(event) => event.stopPropagation()}>
          <div className="modal-header">
            <h3>{opportunityForm.id ? "Edit Opportunity" : "Add New Opportunity"}</h3>
            <button className="close-modal" onClick={() => setOpportunityModalOpen(false)} aria-label="Close opportunity modal">
              {"\u00D7"}
            </button>
          </div>
          <form onSubmit={handleOpportunitySubmit}>
            <div className="form-group">
              <label>Opportunity Name <span className="required">*</span></label>
              <div className="input-wrap">
                <input
                  type="text"
                  placeholder="e.g. Full Stack Web Development"
                  value={opportunityForm.name}
                  onChange={(e) => setOpportunityForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Duration <span className="required">*</span></label>
              <div className="input-wrap">
                <input
                  type="text"
                  placeholder="e.g. 6 Months"
                  value={opportunityForm.duration}
                  onChange={(e) => setOpportunityForm((prev) => ({ ...prev, duration: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Start Date <span className="required">*</span></label>
              <div className="input-wrap">
                <input
                  type="date"
                  value={opportunityForm.startDate}
                  onChange={(e) => setOpportunityForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description <span className="required">*</span></label>
              <div className="input-wrap">
                <textarea
                  placeholder="Describe the opportunity and what participants will learn..."
                  value={opportunityForm.description}
                  onChange={(e) => setOpportunityForm((prev) => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Skills to Gain (comma separated) <span className="required">*</span></label>
              <div className="input-wrap">
                <input
                  type="text"
                  placeholder="e.g. HTML, CSS, JavaScript, React"
                  value={opportunityForm.skillsText}
                  onChange={(e) => setOpportunityForm((prev) => ({ ...prev, skillsText: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Category <span className="required">*</span></label>
              <div className="input-wrap">
                <select
                  value={opportunityForm.category}
                  onChange={(e) => setOpportunityForm((prev) => ({ ...prev, category: e.target.value }))}
                  required
                >
                  <option value="">Select Category</option>
                  <option value="technology">Technology</option>
                  <option value="business">Business</option>
                  <option value="design">Design</option>
                  <option value="marketing">Marketing</option>
                  <option value="data">Data Science</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Future Opportunities <span className="required">*</span></label>
              <div className="input-wrap">
                <textarea
                  placeholder="Describe career paths and opportunities after completion..."
                  value={opportunityForm.futureOpportunities}
                  onChange={(e) => setOpportunityForm((prev) => ({ ...prev, futureOpportunities: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label>Maximum Applicants</label>
              <div className="input-wrap">
                <input
                  type="number"
                  placeholder="e.g. 100"
                  value={opportunityForm.maxApplicants}
                  onChange={(e) => setOpportunityForm((prev) => ({ ...prev, maxApplicants: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Prerequisites</label>
              <div className="input-wrap">
                <textarea
                  placeholder="Optional prerequisites for applicants"
                  value={opportunityForm.prerequisites}
                  onChange={(e) => setOpportunityForm((prev) => ({ ...prev, prerequisites: e.target.value }))}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              {opportunityForm.id ? "Update Opportunity" : "Create Opportunity"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
