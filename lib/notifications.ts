"use client";

// Utilidades de notificaciones del navegador (PWA). Ejecutan solo en el
// cliente y de forma optativa: cada usuario decide si las activa o no.
type WindowNotificationPermission = "default" | "granted" | "denied";

declare global {
  interface Window {
    Notification?: {
      permission: WindowNotificationPermission;
      requestPermission: () => Promise<WindowNotificationPermission> | undefined;
    };
  }
}

function hayApoyo() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificacionesActivas() {
  if (!hayApoyo()) return false;
  return typeof window.Notification !== "undefined" && window.Notification.permission === "granted";
}

export async function habilitarNotificaciones(): Promise<boolean> {
  if (!hayApoyo() || typeof window.Notification === "undefined") return false;
  if (window.Notification.permission === "granted") return true;
  if (window.Notification.permission === "denied") return false;
  try {
    const permiso = await window.Notification.requestPermission();
    return permiso === "granted";
  } catch {
    return false;
  }
}

export function notificar(titulo: string, cuerpo?: string) {
  if (!hayApoyo() || !notificacionesActivas()) return;
  try {
    new Notification(titulo, { body: cuerpo, icon: "/icon-192.png" });
  } catch {
    // La pestaña debe estar abierta; fallar en silencio si el navegador no lo permite.
  }
}