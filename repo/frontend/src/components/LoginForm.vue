<template>
  <section class="mx-auto mt-16 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h1 class="text-2xl font-bold">RoadSafe Inspection Operations</h1>
    <p class="mt-2 text-sm text-slate-600">Secure internal access portal</p>

    <form class="mt-5 space-y-3" @submit.prevent="onSubmit">
      <label class="block text-sm font-medium">
        Username
        <input v-model.trim="form.username" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" autocomplete="username" required />
      </label>
      <label class="block text-sm font-medium">
        Password
        <input
          v-model="form.password"
          type="password"
          class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          autocomplete="current-password"
          required
        />
      </label>
      <button class="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white" type="submit" :disabled="loading">
        {{ loading ? 'Signing in...' : 'Sign In' }}
      </button>
    </form>

    <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';

const emit = defineEmits(['login']);
const loading = ref(false);
const error = ref('');
const form = reactive({ username: '', password: '' });

async function onSubmit() {
  loading.value = true;
  error.value = '';
  try {
    await emit('login', { ...form });
  } catch (err) {
    error.value = err.message || 'Authentication failed';
  } finally {
    loading.value = false;
  }
}
</script>
