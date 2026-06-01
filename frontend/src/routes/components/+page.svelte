<script lang="ts">
  import {
    Plus,
    Trash2,
    Download,
    Search,
    Mail,
    Lock,
    User as UserIcon,
    Edit3,
    MoreHorizontal,
    LogOut
  } from 'lucide-svelte';
  import {
    Alert,
    Badge,
    Button,
    Card,
    Checkbox,
    DatePicker,
    Dropdown,
    DropdownItem,
    Input,
    Modal,
    PageHeader,
    Progress,
    Radio,
    Select,
    Skeleton,
    Spinner,
    Table,
    Tabs,
    Textarea,
    Toggle
  } from '$lib/components/ui';
  import { toast } from '$lib/stores/toast.svelte';

  // form state
  let email = $state('');
  let password = $state('');
  let bio = $state('Building a delightful POS experience.');
  let category = $state('');
  let date = $state('');
  let time = $state('');
  let agree = $state(true);
  let newsletter = $state(false);
  let plan = $state('pro');
  let notifEmail = $state(true);
  let notifPush = $state(false);

  // modal
  let modalOpen = $state(false);

  // tabs
  let activeTab = $state('overview');

  // table
  type Order = {
    id: string;
    customer: string;
    items: number;
    total: string;
    status: 'paid' | 'pending' | 'refunded';
  };

  const orders: Order[] = [
    { id: '#1042', customer: 'Maria Lopez', items: 3, total: '$48.20', status: 'paid' },
    { id: '#1041', customer: 'James Chen', items: 1, total: '$12.99', status: 'pending' },
    { id: '#1040', customer: 'Aisha Patel', items: 7, total: '$132.50', status: 'paid' },
    { id: '#1039', customer: 'Diego Ortiz', items: 2, total: '$24.00', status: 'refunded' }
  ];

  const statusVariant = {
    paid: 'success',
    pending: 'warning',
    refunded: 'danger'
  } as const;

  const orderColumns = [
    { key: 'id' as const, label: 'Order' },
    { key: 'customer' as const, label: 'Customer' },
    { key: 'items' as const, label: 'Items', align: 'right' as const },
    { key: 'total' as const, label: 'Total', align: 'right' as const },
    { key: 'status' as const, label: 'Status' }
  ];
</script>

<svelte:head>
  <title>Components · POS Admin</title>
</svelte:head>

<PageHeader
  title="Components"
  description="Reference for every UI primitive available in this app."
  breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Components' }]}
/>

<div class="space-y-8">
  <!-- Buttons -->
  <section>
    <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Buttons</h2>
    <Card title="Variants & sizes" description="Six visual styles in three sizes, with loading and disabled states.">
      <div class="space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="success">Success</Button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <Button>
            <Plus class="h-4 w-4" />
            Add product
          </Button>
          <Button variant="outline">
            <Download class="h-4 w-4" />
            Export
          </Button>
          <Button variant="danger">
            <Trash2 class="h-4 w-4" />
            Delete
          </Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
      </div>
    </Card>
  </section>

  <!-- Forms -->
  <section>
    <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Forms</h2>
    <Card title="Form controls" description="Inputs, textareas, selects and date pickers — labelled, hinted, with error states.">
      <div class="grid gap-5 sm:grid-cols-2">
        <Input label="Email" placeholder="you@example.com" bind:value={email} type="email">
          {#snippet leading()}<Mail class="h-4 w-4" />{/snippet}
        </Input>

        <Input
          label="Password"
          placeholder="••••••••"
          type="password"
          bind:value={password}
          hint="Min. 8 characters."
        >
          {#snippet leading()}<Lock class="h-4 w-4" />{/snippet}
        </Input>

        <Input
          label="Username"
          placeholder="username"
          value="taken"
          error="This username is already in use."
        >
          {#snippet leading()}<UserIcon class="h-4 w-4" />{/snippet}
        </Input>

        <Input label="Search" placeholder="Find anything…">
          {#snippet leading()}<Search class="h-4 w-4" />{/snippet}
        </Input>

        <Select
          label="Category"
          bind:value={category}
          placeholder="Select a category"
          options={[
            { value: 'beverage', label: 'Beverages' },
            { value: 'food', label: 'Food' },
            { value: 'merch', label: 'Merchandise' },
            { value: 'gift', label: 'Gift cards', disabled: true }
          ]}
        />

        <DatePicker label="Order date" bind:value={date} />

        <DatePicker label="Pickup time" mode="time" bind:value={time} />

        <Textarea
          class="sm:col-span-2"
          label="Notes"
          placeholder="Add any internal notes…"
          bind:value={bio}
          hint="Visible to staff only."
        />
      </div>
    </Card>

    <Card class="mt-4" title="Selection controls">
      <div class="grid gap-6 sm:grid-cols-2">
        <div class="space-y-3">
          <p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Checkboxes</p>
          <Checkbox
            label="I agree to the terms"
            description="You can review them anytime."
            bind:checked={agree}
          />
          <Checkbox label="Subscribe to newsletter" bind:checked={newsletter} />
          <Checkbox label="Disabled option" disabled />
        </div>

        <div class="space-y-3">
          <p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Plan</p>
          <Radio
            name="plan"
            value="starter"
            bind:group={plan}
            label="Starter"
            description="Up to 100 products"
          />
          <Radio
            name="plan"
            value="pro"
            bind:group={plan}
            label="Pro"
            description="Up to 10,000 products"
          />
          <Radio
            name="plan"
            value="enterprise"
            bind:group={plan}
            label="Enterprise"
            description="Unlimited"
          />
        </div>

        <div class="space-y-3 sm:col-span-2">
          <p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Notifications</p>
          <Toggle
            bind:checked={notifEmail}
            label="Email alerts"
            description="Get receipts and reports by email."
          />
          <Toggle
            bind:checked={notifPush}
            label="Push notifications"
            description="Real-time alerts on this device."
          />
        </div>
      </div>
    </Card>
  </section>

  <!-- Feedback -->
  <section>
    <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Feedback</h2>
    <Card title="Alerts" description="Inline messages, optionally dismissible.">
      <div class="space-y-3">
        <Alert variant="info" title="Heads up">
          A new firmware update is available for your receipt printer.
        </Alert>
        <Alert variant="success" title="Payment received">
          Order #1042 was paid successfully via card.
        </Alert>
        <Alert variant="warning" title="Low stock" dismissible>
          4 products are below their minimum stock threshold.
        </Alert>
        <Alert variant="error" title="Sync failed" dismissible>
          We couldn’t reach the inventory service. We’ll retry automatically.
        </Alert>
      </div>
    </Card>

    <Card class="mt-4" title="Toasts" description="Transient messages — try the buttons.">
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" onclick={() => toast.info('Heads up', 'Just an FYI.')}>
          Info
        </Button>
        <Button
          variant="success"
          onclick={() => toast.success('Saved', 'Your changes have been saved.')}
        >
          Success
        </Button>
        <Button
          variant="outline"
          onclick={() => toast.warning('Careful', 'Stock is running low.')}
        >
          Warning
        </Button>
        <Button
          variant="danger"
          onclick={() => toast.error('Error', 'Something went wrong.')}
        >
          Error
        </Button>
      </div>
    </Card>

    <Card class="mt-4" title="Progress & loading">
      <div class="grid gap-6 sm:grid-cols-2">
        <div class="space-y-4">
          <Progress label="Today's goal" value={64} showValue />
          <Progress label="Inventory health" value={88} variant="success" showValue />
          <Progress label="Low stock" value={22} variant="warning" showValue />
          <Progress label="Errors" value={6} variant="danger" showValue />
        </div>
        <div class="flex items-center gap-5">
          <Spinner size="xs" />
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
        <div class="space-y-2 sm:col-span-2">
          <p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Skeleton</p>
          <div class="flex items-center gap-3">
            <Skeleton class="h-10 w-10" rounded="full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-3 w-1/3" />
              <Skeleton class="h-3 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  </section>

  <!-- Display -->
  <section>
    <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Display</h2>
    <Card title="Badges">
      <div class="flex flex-wrap items-center gap-2">
        <Badge>Neutral</Badge>
        <Badge variant="brand">Brand</Badge>
        <Badge variant="success" dot>Paid</Badge>
        <Badge variant="warning" dot>Pending</Badge>
        <Badge variant="danger" dot>Refunded</Badge>
        <Badge variant="info">Beta</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="brand" size="sm">small</Badge>
      </div>
    </Card>

    <Card class="mt-4" title="Tabs">
      <Tabs
        bind:value={activeTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'analytics', label: 'Analytics', badge: '4' },
          { value: 'reports', label: 'Reports' },
          { value: 'settings', label: 'Settings' }
        ]}
      />
      <div class="mt-4 text-sm text-slate-600">
        Active tab: <span class="font-medium text-slate-900">{activeTab}</span>
      </div>
    </Card>

    <Card class="mt-4" title="Dropdown">
      <div class="flex flex-wrap gap-3">
        <Dropdown label="Actions">
          {#snippet children({ close })}
            <DropdownItem
              onclick={() => {
                toast.info('Editing…');
                close();
              }}
            >
              <Edit3 class="h-4 w-4 text-slate-400" />
              Edit
            </DropdownItem>
            <DropdownItem
              onclick={() => {
                toast.info('Duplicated');
                close();
              }}
            >
              <MoreHorizontal class="h-4 w-4 text-slate-400" />
              Duplicate
            </DropdownItem>
            <DropdownItem
              danger
              onclick={() => {
                toast.error('Deleted');
                close();
              }}
            >
              <Trash2 class="h-4 w-4" />
              Delete
            </DropdownItem>
          {/snippet}
        </Dropdown>

        <Dropdown align="right">
          {#snippet trigger({ open, toggle })}
            <Button variant="ghost" size="sm" onclick={toggle}>
              <MoreHorizontal class="h-4 w-4" />
              More
            </Button>
          {/snippet}
          {#snippet children({ close })}
            <DropdownItem href="/profile">
              <UserIcon class="h-4 w-4 text-slate-400" />
              View profile
            </DropdownItem>
            <DropdownItem
              danger
              onclick={() => {
                toast.success('Signed out');
                close();
              }}
            >
              <LogOut class="h-4 w-4" />
              Sign out
            </DropdownItem>
          {/snippet}
        </Dropdown>
      </div>
    </Card>

    <div class="mt-4">
      <Table
        columns={orderColumns}
        rows={orders}
        rowKey={(o) => o.id}
      >
        {#snippet cell({ row, column, value })}
          {#if column.key === 'status'}
            <Badge variant={statusVariant[row.status]} dot>{value}</Badge>
          {:else}
            {value}
          {/if}
        {/snippet}
      </Table>
    </div>
  </section>

  <!-- Overlays -->
  <section>
    <h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Overlays</h2>
    <Card title="Modal">
      <Button onclick={() => (modalOpen = true)}>Open modal</Button>
    </Card>
  </section>
</div>

<Modal
  bind:open={modalOpen}
  title="Create new product"
  description="Add a product to your catalog."
>
  <div class="space-y-4">
    <Input label="Name" placeholder="e.g. Espresso" />
    <Input label="SKU" placeholder="SKU-0001" />
    <Select
      label="Category"
      placeholder="Pick one"
      options={[
        { value: 'beverage', label: 'Beverages' },
        { value: 'food', label: 'Food' }
      ]}
    />
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (modalOpen = false)}>Cancel</Button>
    <Button
      onclick={() => {
        modalOpen = false;
        toast.success('Product created', 'Your new product is now live.');
      }}
    >
      Create product
    </Button>
  {/snippet}
</Modal>
