export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  stock: number;
  category: string;
  images: string[];
  isFeatured: boolean;
  isActive: boolean;
  /** Customer-facing package size, e.g. "250 ml", "500 g", "12 pcs". Defaults to '' for legacy products. */
  packageSize: string;
  /** @deprecated Legacy physical weight in grams. No longer collected via admin UI; retained only as an
   * internal fallback for shipping-weight calculations (logistics). Not shown to customers. */
  weight?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingAddress {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  /** Customer-facing package size snapshot at time of order, e.g. "250 ml", "500 g", "12 pcs". */
  packageSize?: string;
  /** @deprecated Legacy physical weight in grams, retained only for internal logistics/shipping calculations. */
  weight?: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  shippingCharge: number;
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  shippingAddress: ShippingAddress;
  invoiceUrl: string;
  labelUrl: string;
  trackingNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  qty: number;
  product?: Product; // Dynamically joined on client
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'VIEWER';
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  isVerified?: boolean;
  isBanned?: boolean;
  twoFactorEnabled?: boolean;
  googleAvatar?: string;
  authProvider?: string;
  otpVerified?: boolean;
}

export interface DashboardStats {
  stats: {
    revenueToday: number;
    revenueMonth: number;
    revenueAllTime: number;
    totalOrders: number;
    newCustomersCount: number;
  };
  orderBreakdown: {
    PENDING: number;
    CONFIRMED: number;
    SHIPPED: number;
    DELIVERED: number;
    CANCELLED: number;
  };
  lowStockAlerts: Array<{
    id: string;
    name: string;
    stock: number;
  }>;
}

export interface CustomerHistory {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedDate: string;
  totalOrders: number;
  totalSpent: number;
}
