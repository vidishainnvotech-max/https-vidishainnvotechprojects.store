<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
use App\Models\Category;
use App\Models\College;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function createAdmin(string $mobile = '9000000001'): User
    {
        $college = College::firstOrCreate(
            ['name' => 'Admin College '.uniqid()]
        );

        return User::factory()->create([
            'mobile' => $mobile,
            'college_id' => $college->id,
            'role' => 'admin',
        ]);
    }

    private function createStudent(string $mobile = '9000000002'): User
    {
        $college = College::firstOrCreate(
            ['name' => 'Student College '.uniqid()]
        );

        return User::factory()->create([
            'mobile' => $mobile,
            'college_id' => $college->id,
            'role' => 'student',
        ]);
    }

    private function createProject(): Project
    {
        $category = Category::create([
            'name' => 'Test Category '.uniqid(),
            'slug' => 'test-category-'.uniqid(),
        ]);

        return Project::create([
            'category_id' => $category->id,
            'title' => 'Notification Test Project',
            'slug' => 'notification-test-'.uniqid(),
            'abstract' => 'Project for notification tests.',
            'is_iot' => true,
            'kit_price' => 1500,
        ]);
    }

    public function test_idea_submission_creates_notification(): void
    {
        $admin = $this->createAdmin();
        $student = $this->createStudent();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Smart irrigation system',
                'description' => 'A detailed description of the smart irrigation project.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('admin_notifications', [
            'admin_id' => $admin->id,
            'type' => 'project_idea',
        ]);

        $notification = AdminNotification::where('admin_id', $admin->id)
            ->where('type', 'project_idea')
            ->first();

        $this->assertNotNull($notification);
        $this->assertNull($notification->read_at);
        $this->assertNotNull($notification->url);
    }

    public function test_shipment_creation_creates_notification(): void
    {
        $admin = $this->createAdmin();
        $student = $this->createStudent();
        $project = $this->createProject();

        $plan = Plan::create([
            'name' => 'Test Plan',
            'code' => 'C1',
            'price' => 1500,
            'installments' => 1,
            'unlock_map' => [['stages' => [100], 'bundles' => []]],
            'is_active' => true,
        ]);

        $order = Order::create([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'plan_id' => $plan->id,
            'base_price' => 1500,
            'discount_amount' => 0,
            'total' => 1500,
            'status' => 'complete',
        ]);

        Payment::create([
            'order_id' => $order->id,
            'user_id' => $student->id,
            'installment_no' => 1,
            'amount' => 1500,
            'status' => 'success',
            'paid_at' => now(),
        ]);

        $this->actingAs($student)
            ->postJson("/api/projects/{$project->id}/iot-shipments", [
                'order_id' => $order->id,
                'recipient_name' => 'Test Recipient',
                'recipient_phone' => '9876543210',
                'shipping_address' => '123 Test Street',
                'city' => 'Mumbai',
                'state' => 'Maharashtra',
                'postal_code' => '400001',
                'country' => 'India',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('admin_notifications', [
            'admin_id' => $admin->id,
            'type' => 'iot_shipment',
        ]);

        $notification = AdminNotification::where('admin_id', $admin->id)
            ->where('type', 'iot_shipment')
            ->first();

        $this->assertNotNull($notification);
        $this->assertNull($notification->read_at);
    }

    public function test_order_creation_creates_notification(): void
    {
        $admin = $this->createAdmin();
        $student = $this->createStudent();
        $project = $this->createProject();

        $plan = Plan::create([
            'name' => 'Test Plan',
            'code' => 'C1',
            'price' => 1500,
            'installments' => 1,
            'unlock_map' => [['stages' => [100], 'bundles' => []]],
            'is_active' => true,
        ]);

        $this->actingAs($student)
            ->postJson('/api/orders', [
                'project_id' => $project->id,
                'plan_id' => $plan->id,
                'shipment' => [
                    'recipient_name' => 'Notification Recipient',
                    'recipient_phone' => '9876543210',
                    'shipping_address' => '123 Notification Street',
                    'city' => 'Mumbai',
                    'state' => 'Maharashtra',
                    'postal_code' => '400001',
                    'country' => 'India',
                    'quantity' => 1,
                ],
            ])
            ->assertCreated();

        $this->assertDatabaseHas('admin_notifications', [
            'admin_id' => $admin->id,
            'type' => 'order',
        ]);

        $notification = AdminNotification::where('admin_id', $admin->id)
            ->where('type', 'order')
            ->first();

        $this->assertNotNull($notification);
        $this->assertNull($notification->read_at);
    }

    public function test_notifications_are_isolated_per_admin(): void
    {
        $admin1 = $this->createAdmin('9000000101');
        $admin2 = $this->createAdmin('9000000102');
        $student = $this->createStudent();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Isolation test idea',
                'description' => 'A detailed description for isolation testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $admin1Notifications = AdminNotification::where('admin_id', $admin1->id)
            ->where('type', 'project_idea')
            ->count();

        $admin2Notifications = AdminNotification::where('admin_id', $admin2->id)
            ->where('type', 'project_idea')
            ->count();

        $this->assertEquals(1, $admin1Notifications);
        $this->assertEquals(1, $admin2Notifications);
    }

    public function test_duplicate_notifications_are_prevented(): void
    {
        $admin = $this->createAdmin();
        $student = $this->createStudent();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Duplicate test idea',
                'description' => 'A detailed description for duplicate testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Duplicate test idea',
                'description' => 'A detailed description for duplicate testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $count = AdminNotification::where('admin_id', $admin->id)
            ->where('type', 'project_idea')
            ->count();

        $this->assertEquals(2, $count);
    }

    public function test_admin_can_fetch_own_notifications(): void
    {
        $admin = $this->createAdmin();
        $student = $this->createStudent();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Fetch test idea',
                'description' => 'A detailed description for fetch testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $response = $this->actingAs($admin)
            ->getJson('/api/admin/notifications');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('unread_count', 1);
    }

    public function test_admin_can_mark_notification_as_read(): void
    {
        $admin = $this->createAdmin();
        $student = $this->createStudent();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Read test idea',
                'description' => 'A detailed description for read testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $notification = AdminNotification::where('admin_id', $admin->id)->first();

        $this->actingAs($admin)
            ->patchJson("/api/admin/notifications/{$notification->id}/read")
            ->assertOk()
            ->assertJsonPath('success', true);

        $notification->refresh();
        $this->assertNotNull($notification->read_at);
    }

    public function test_admin_can_mark_all_notifications_as_read(): void
    {
        $admin = $this->createAdmin();
        $student = $this->createStudent();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Bulk read test 1',
                'description' => 'First idea for bulk read testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Bulk read test 2',
                'description' => 'Second idea for bulk read testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $this->actingAs($admin)
            ->patchJson('/api/admin/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('success', true);

        $unreadCount = AdminNotification::where('admin_id', $admin->id)
            ->whereNull('read_at')
            ->count();

        $this->assertEquals(0, $unreadCount);
    }

    public function test_non_admin_cannot_access_notifications(): void
    {
        $student = $this->createStudent();

        $this->actingAs($student)
            ->getJson('/api/admin/notifications')
            ->assertForbidden();
    }

    public function test_guest_cannot_access_notifications(): void
    {
        $this->getJson('/api/admin/notifications')
            ->assertUnauthorized();
    }

    public function test_admin_cannot_read_another_admins_notifications(): void
    {
        $admin1 = $this->createAdmin('9000000201');
        $admin2 = $this->createAdmin('9000000202');
        $student = $this->createStudent();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Cross-admin test idea',
                'description' => 'A detailed description for cross-admin testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $admin2Notification = AdminNotification::where('admin_id', $admin2->id)
            ->where('type', 'project_idea')
            ->first();

        $this->actingAs($admin1)
            ->getJson('/api/admin/notifications')
            ->assertOk()
            ->assertJsonMissing(['id' => $admin2Notification->id]);
    }

    public function test_admin_cannot_mark_another_admins_notification_as_read(): void
    {
        $admin1 = $this->createAdmin('9000000201');
        $admin2 = $this->createAdmin('9000000202');
        $student = $this->createStudent();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'Cross-admin mark test',
                'description' => 'A detailed description for cross-admin mark testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $admin2Notification = AdminNotification::where('admin_id', $admin2->id)
            ->where('type', 'project_idea')
            ->first();

        $this->actingAs($admin1)
            ->patchJson("/api/admin/notifications/{$admin2Notification->id}/read")
            ->assertNotFound();

        $admin2Notification->refresh();
        $this->assertNull($admin2Notification->read_at);
    }

    public function test_notification_urls_point_to_valid_admin_routes(): void
    {
        $admin = $this->createAdmin();
        $student = $this->createStudent();

        $this->actingAs($student)
            ->postJson('/api/student/ideas', [
                'title' => 'URL validation test',
                'description' => 'A detailed description for URL validation testing.',
                'whatsapp' => '9876543210',
            ])
            ->assertCreated();

        $notification = AdminNotification::where('admin_id', $admin->id)
            ->where('type', 'project_idea')
            ->first();

        $this->assertNotNull($notification->url);
        $this->assertStringStartsWith('/admin/', $notification->url);
    }
}
