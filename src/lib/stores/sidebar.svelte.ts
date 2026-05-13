class SidebarState {
  collapsed = $state(false);
  mobileOpen = $state(false);

  toggleCollapsed() {
    this.collapsed = !this.collapsed;
  }
  openMobile() {
    this.mobileOpen = true;
  }
  closeMobile() {
    this.mobileOpen = false;
  }
}

export const sidebar = new SidebarState();
