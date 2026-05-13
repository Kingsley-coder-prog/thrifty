import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      redirect: "/auth/login",
    },
    {
      path: "/auth/login",
      name: "login",
      component: () => import("@/views/auth/LoginView.vue"),
      meta: { guest: true },
    },
    {
      path: "/auth/register",
      name: "register",
      component: () => import("@/views/auth/RegisterView.vue"),
      meta: { guest: true },
    },
    {
      path: "/auth/forgot-password",
      name: "forgot-password",
      component: () => import("@/views/auth/ForgotPasswordView.vue"),
      meta: { guest: true },
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: () => import("@/views/dashboard/DashboardView.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to, from) => {
  const token = localStorage.getItem("accessToken");

  if (to.meta.requiresAuth && !token) {
    return { name: "login" };
  }

  if (to.meta.guest && token) {
    return { name: "dashboard" };
  }
});

export default router;
