enum Role {
  ADMIN
  CUSTOMER
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
  RETURNED
}

enum PaymentStatus {
  UNPAID
  PAID
  FAILED
  REFUNDED
}

enum PaymentProvider {
  STRIPE
  SSLCOMMERZ
  BKASH
  COD
}

enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
}

enum ReturnStatus {
  PENDING
  APPROVED
  REJECTED
  REFUNDED
}

enum TransactionType {
  EARNED
  REDEEMED
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  CLOSED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
}model User {
  id             String         @id @default(uuid())
  name           String
  email          String         @unique
  password_hash  String
  phone          String?
  avatar_url     String?
  role           Role           @default(CUSTOMER)
  is_active      Boolean        @default(true)
  addresses      Address[]
  orders         Order[]
  reviews        Review[]
  reward_points  RewardPoint[]
  tickets        Ticket[]
  created_at     DateTime       @default(now())
  updated_at     DateTime       @updatedAt
}

model Address {
  id             String         @id @default(uuid())
  user_id        String
  user           User           @relation(fields: [user_id], references: [id])
  address_line1  String
  address_line2  String?
  city           String
  state          String
  postal_code    String
  country        String
  is_default     Boolean        @default(false)
}model Category {
  id             String         @id @default(uuid())
  name           String
  slug           String         @unique
  parent_id      String?
  parent         Category?      @relation("CategoryHierarchy", fields: [parent_id], references: [id])
  children       Category[]     @relation("CategoryHierarchy")
  icon_url       String?
  products       Product[]
  meta_title     String?
  meta_desc      String?
}

model Product {
  id               String           @id @default(uuid())
  category_id      String
  category         Category         @relation(fields: [category_id], references: [id])
  name             String
  slug             String           @unique
  description      String           @db.Text
  base_price       Decimal
  discount_price   Decimal?
  sku              String           @unique
  stock_quantity   Int              @default(0)
  is_published     Boolean          @default(false)
  images           ProductImage[]
  variants         ProductVariant[]
  reviews          Review[]
  meta_title       String?
  meta_desc        String?
  created_at       DateTime         @default(now())
  updated_at       DateTime         @updatedAt
}

model ProductImage {
  id             String         @id @default(uuid())
  product_id     String
  product        Product        @relation(fields: [product_id], references: [id])
  url            String
  is_thumbnail   Boolean        @default(false)
}model Attribute {
  id             String             @id @default(uuid())
  name           String             // e.g., "Size", "Color"
  options        AttributeOption[]
}

model AttributeOption {
  id             String             @id @default(uuid())
  attribute_id   String
  attribute      Attribute          @relation(fields: [attribute_id], references: [id])
  value          String             // e.g., "XL", "Red"
  variants       VariantOption[]
}

model ProductVariant {
  id             String             @id @default(uuid())
  product_id     String
  product        Product            @relation(fields: [product_id], references: [id])
  sku            String             @unique
  price          Decimal
  stock_quantity Int
  image_url      String?
  options        VariantOption[]
}

model VariantOption {
  id                  String           @id @default(uuid())
  variant_id          String
  variant             ProductVariant   @relation(fields: [variant_id], references: [id])
  attribute_option_id String
  attribute_option    AttributeOption  @relation(fields: [attribute_option_id], references: [id])
}model Cart {
  id             String         @id @default(uuid())
  session_id     String?        @unique 
  user_id        String?        @unique
  items          CartItem[]
  updated_at     DateTime       @updatedAt
}

model CartItem {
  id             String         @id @default(uuid())
  cart_id        String
  cart           Cart           @relation(fields: [cart_id], references: [id])
  product_id     String
  quantity       Int            @default(1)
}

model Wishlist {
  id             String         @id @default(uuid())
  user_id        String
  product_id     String
  created_at     DateTime       @default(now())
  @@unique([user_id, product_id])
}model Order {
  id               String           @id @default(uuid())
  user_id          String?
  user             User?            @relation(fields: [user_id], references: [id])
  total_amount     Decimal
  discount_amount  Decimal          @default(0.00)
  shipping_fee     Decimal          @default(0.00)
  status           OrderStatus      @default(PENDING)
  payment_status   PaymentStatus    @default(UNPAID)
  shipping_address Json             
  items            OrderItem[]
  payment          Payment?
  tracking         OrderTracking?
  return_request   ReturnRequest?
  created_at       DateTime         @default(now())
  updated_at       DateTime         @updatedAt
}

model OrderItem {
  id             String         @id @default(uuid())
  order_id       String
  order          Order          @relation(fields: [order_id], references: [id])
  product_id     String
  variant_id     String?        
  quantity       Int
  unit_price     Decimal
}

model ShippingMethod {
  id             String         @id @default(uuid())
  name           String         
  cost           Decimal
  estimated_days String         
}

model OrderTracking {
  id               String         @id @default(uuid())
  order_id         String         @unique
  order            Order          @relation(fields: [order_id], references: [id])
  courier_name     String
  tracking_number  String
  tracking_url     String?
  status_update    String?
  updated_at       DateTime       @updatedAt
}model Payment {
  id               String           @id @default(uuid())
  order_id         String           @unique
  order            Order            @relation(fields: [order_id], references: [id])
  provider         PaymentProvider
  transaction_id   String?          @unique
  amount           Decimal
  status           PaymentStatus    @default(PENDING)
  created_at       DateTime         @default(now())
}model Coupon {
  id                   String       @id @default(uuid())
  code                 String       @unique
  discount_type        DiscountType
  discount_value       Decimal
  min_order_amount     Decimal?
  max_discount_amount  Decimal?
  usage_limit          Int?
  used_count           Int          @default(0)
  valid_from           DateTime
  valid_until          DateTime
  is_active            Boolean      @default(true)
}model Review {
  id             String         @id @default(uuid())
  user_id        String
  user           User           @relation(fields: [user_id], references: [id])
  product_id     String
  product        Product        @relation(fields: [product_id], references: [id])
  order_id       String?        
  rating         Int            
  comment        String?        @db.Text
  is_approved    Boolean        @default(false)
  images         ReviewImage[]
  reply          ReviewReply?
  created_at     DateTime       @default(now())
  updated_at     DateTime       @updatedAt
}

model ReviewImage {
  id             String         @id @default(uuid())
  review_id      String
  review         Review         @relation(fields: [review_id], references: [id])
  image_url      String
}

model ReviewReply {
  id             String         @id @default(uuid())
  review_id      String         @unique
  review         Review         @relation(fields: [review_id], references: [id])
  admin_id       String         
  reply_text     String         @db.Text
  created_at     DateTime       @default(now())
}model ReturnRequest {
  id             String         @id @default(uuid())
  order_id       String         @unique
  order          Order          @relation(fields: [order_id], references: [id])
  user_id        String
  reason         String         @db.Text
  status         ReturnStatus   @default(PENDING)
  admin_note     String?        @db.Text
  created_at     DateTime       @default(now())
  updated_at     DateTime       @updatedAt
}model RewardPoint {
  id               String           @id @default(uuid())
  user_id          String
  user             User             @relation(fields: [user_id], references: [id])
  points           Int
  transaction_type TransactionType
  description      String
  created_at       DateTime         @default(now())
}model Ticket {
  id             String         @id @default(uuid())
  user_id        String
  user           User           @relation(fields: [user_id], references: [id])
  order_id       String?
  subject        String
  status         TicketStatus   @default(OPEN)
  priority       TicketPriority @default(MEDIUM)
  messages       TicketMessage[]
  created_at     DateTime       @default(now())
  updated_at     DateTime       @updatedAt
}

model TicketMessage {
  id             String         @id @default(uuid())
  ticket_id      String
  ticket         Ticket         @relation(fields: [ticket_id], references: [id])
  sender_id      String         
  message        String         @db.Text
  created_at     DateTime       @default(now())
}model AppSetting {
  key            String         @id
  value          String         @db.Text 
  updated_at     DateTime       @updatedAt
}