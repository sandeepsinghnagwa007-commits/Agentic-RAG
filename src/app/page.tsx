"use client";

import React, { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!email || !password) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Sign In Flow
        const res = await signIn("credentials", {
          redirect: false,
          email,
          password,
        });

        if (res?.error) {
          setError(res.error || "Invalid credentials.");
        } else {
          router.push("/dashboard");
        }
      } else {
        // Register Flow
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to register.");
        } else {
          setSuccess("Account created successfully! Logging you in...");
          
          // Auto sign in
          const loginRes = await signIn("credentials", {
            redirect: false,
            email,
            password,
          });

          if (loginRes?.error) {
            setError("Created account but failed auto-login. Please login manually.");
            setIsLogin(true);
          } else {
            router.push("/dashboard");
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--bg-base)",
        color: "var(--text-secondary)"
      }}>
        <div className="pulse-glow" style={{
          padding: "24px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
          textAlign: "center"
        }}>
          <h3>Loading sandbox session...</h3>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "24px"
    }}>
      <div className="glass-panel" style={{
        width: "100%",
        maxWidth: "420px",
        padding: "40px 32px",
        boxShadow: "0 0 40px rgba(157, 78, 221, 0.15)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--primary), var(--secondary))",
            color: "white",
            fontSize: "24px",
            fontWeight: "bold",
            marginBottom: "16px",
            boxShadow: "0 0 20px rgba(157, 78, 221, 0.4)"
          }}>
            R
          </div>
          <h2 style={{ fontSize: "24px", marginBottom: "8px" }}>Learn RAG Sandbox</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            {isLogin ? "Log in to access the multi-agent pipeline" : "Create a student profile to begin learning"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="input-group">
              <label className="input-label">Name</label>
              <input
                type="text"
                className="input-control"
                placeholder="Student Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              type="email"
              className="input-control"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              type="password"
              className="input-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(239, 71, 111, 0.1)",
              border: "1px solid var(--error)",
              color: "var(--error)",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              marginBottom: "20px"
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              background: "rgba(6, 214, 160, 0.1)",
              border: "1px solid var(--success)",
              color: "var(--success)",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              marginBottom: "20px"
            }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px", marginTop: "8px" }}
            disabled={loading}
          >
            {loading ? "Please wait..." : isLogin ? "Access Sandbox" : "Create Profile"}
          </button>
        </form>

        <div style={{
          marginTop: "24px",
          textAlign: "center",
          fontSize: "14px",
          color: "var(--text-secondary)"
        }}>
          {isLogin ? "First time here? " : "Already have a profile? "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setSuccess("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--secondary)",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            {isLogin ? "Sign Up" : "Log In"}
          </button>
        </div>
      </div>
    </div>
  );
}
