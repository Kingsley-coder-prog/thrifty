import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      redirect: "/dashboard",
    },
    {
      path: "/auth/login",
      name: "login",
      component: () => import("@/views/auth/LoginView.vue"),
      meta: { guest: true },
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: () => import("@/views/dashboard/DashboardView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/users",
      name: "users",
      component: () => import("@/views/users/UsersView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/users/:id",
      name: "user-detail",
      component: () => import("@/views/users/UserDetailView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/groups",
      name: "groups",
      component: () => import("@/views/groups/GroupsView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/contributions",
      name: "contributions",
      component: () => import("@/views/contributions/ContributionsView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/payouts",
      name: "payouts",
      component: () => import("@/views/payouts/PayoutsView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/fraud",
      name: "fraud",
      component: () => import("@/views/fraud/FraudView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/disputes",
      name: "disputes",
      component: () => import("@/views/disputes/DisputesView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/audit",
      name: "audit",
      component: () => import("@/views/audit/AuditView.vue"),
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach((to) => {
  const token = localStorage.getItem("adminToken");
  if (to.meta.requiresAuth && !token) return { name: "login" };
  if (to.meta.guest && token) return { name: "dashboard" };
});

export default router;
