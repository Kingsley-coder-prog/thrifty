import { defineStore } from "pinia";
import { ref } from "vue";
import { groupsApi } from "@/api/groups";

export const useGroupsStore = defineStore("groups", () => {
  const myGroups = ref([]);
  const tiers = ref([]);
  const loading = ref(false);

  async function fetchMyGroups() {
    loading.value = true;
    try {
      const { data } = await groupsApi.getMyGroups();
      myGroups.value = data.groups;
      return data.groups;
    } finally {
      loading.value = false;
    }
  }

  async function fetchTiers() {
    const { data } = await groupsApi.getTiers();
    tiers.value = data.tiers;
    return data.tiers;
  }

  return {
    myGroups,
    tiers,
    loading,
    fetchMyGroups,
    fetchTiers,
  };
});
