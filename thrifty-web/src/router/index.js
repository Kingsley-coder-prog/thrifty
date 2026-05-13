import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      redirect: "/dashboard",
    },
    // Auth routes
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
    // App routes — all use AppLayout
    {
      path: "/dashboard",
      name: "dashboard",
      component: () => import("@/views/dashboard/DashboardView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/groups",
      name: "groups",
      component: () => import("@/views/groups/GroupsView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/groups/:id",
      name: "group-detail",
      component: () => import("@/views/groups/GroupDetailView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/payments",
      name: "payments",
      component: () => import("@/views/payments/PaymentsView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/profile",
      name: "profile",
      component: () => import("@/views/profile/ProfileView.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem("accessToken");
  if (to.meta.requiresAuth && !token) return { name: "login" };
  if (to.meta.guest && token) return { name: "dashboard" };
});

export default router;
