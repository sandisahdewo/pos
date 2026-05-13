<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import TopBar from '$lib/components/layout/TopBar.svelte';
  import ToastContainer from '$lib/components/layout/ToastContainer.svelte';
  import { sidebar } from '$lib/stores/sidebar.svelte';

  let { children } = $props();
</script>

<div class="flex min-h-full">
  <Sidebar />

  <div
    class="flex min-h-screen flex-1 flex-col transition-[padding] duration-200
      {sidebar.collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}"
  >
    <TopBar />
    <main class="flex-1 px-4 py-6 sm:px-6 lg:px-8">
      {@render children()}
    </main>
  </div>
</div>

<ToastContainer />
