type User = {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
};

class UserState {
  current = $state<User>({
    name: 'Sandi Reyes',
    email: 'sandi@example.com',
    role: 'Administrator'
  });
}

export const user = new UserState();
