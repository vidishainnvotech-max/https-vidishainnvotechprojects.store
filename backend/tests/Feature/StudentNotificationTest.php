<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\College;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Project;
use App\Models\StudentNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_only_receives_notifications_for_own_orders(): void
    {
        [$student, $order] = $this->orderFor('9000011001', 'First Student Project');
        [$otherStudent, $otherOrder] = $this->orderFor('9000011002', 'Other Student Project');

        Payment::create([
            'order_id' => $order->id,
            'installment_no' => 1,
            'amount' => 5000,
            'status' => 'success',
            'paid_at' => now(),
        ]);
        Payment::create([
            'order_id' => $otherOrder->id,
            'installment_no' => 1,
            'amount' => 5000,
            'status' => 'success',
            'paid_at' => now(),
        ]);

        $response = $this->actingAs($student, 'sanctum')
            ->getJson('/api/student/notifications')
            ->assertOk()
            ->assertJsonPath('success', true);

        $messages = collect($response->json('data'))->pluck('message')->implode(' ');
        $this->assertStringContainsString('First Student Project', $messages);
        $this->assertStringNotContainsString('Other Student Project', $messages);
        $this->assertDatabaseMissing('student_notifications', [
            'user_id' => $student->id,
            'notification_key' => "order:{$otherOrder->id}:created",
        ]);
        $this->assertDatabaseCount('student_notifications', 3);
        $this->assertSame(0, StudentNotification::where('user_id', $otherStudent->id)->count());
    }

    public function test_student_can_mark_only_own_notification_as_read(): void
    {
        [$student] = $this->orderFor('9000011011', 'Readable Project');
        [$otherStudent] = $this->orderFor('9000011012', 'Private Project');

        $this->actingAs($student, 'sanctum')->getJson('/api/student/notifications')->assertOk();
        $this->actingAs($otherStudent, 'sanctum')->getJson('/api/student/notifications')->assertOk();

        $ownNotification = StudentNotification::where('user_id', $student->id)->firstOrFail();
        $otherNotification = StudentNotification::where('user_id', $otherStudent->id)->firstOrFail();

        $this->actingAs($student, 'sanctum')
            ->patchJson("/api/student/notifications/{$ownNotification->id}/read")
            ->assertOk();
        $this->actingAs($student, 'sanctum')
            ->patchJson("/api/student/notifications/{$otherNotification->id}/read")
            ->assertNotFound();

        $this->assertNotNull($ownNotification->fresh()->read_at);
        $this->assertNull($otherNotification->fresh()->read_at);
    }

    public function test_guest_cannot_access_student_notifications(): void
    {
        $this->getJson('/api/student/notifications')->assertUnauthorized();
    }

    private function orderFor(string $mobile, string $title): array
    {
        $college = College::create(['name' => 'Notification College '.uniqid()]);
        $student = User::factory()->create([
            'mobile' => $mobile,
            'college_id' => $college->id,
            'role' => 'student',
        ]);
        $category = Category::create([
            'name' => 'Notification Category '.uniqid(),
            'slug' => 'notification-category-'.uniqid(),
        ]);
        $project = Project::create([
            'category_id' => $category->id,
            'title' => $title,
            'slug' => 'student-notification-project-'.uniqid(),
            'project_type' => 'standard',
            'is_active' => true,
        ]);
        $plan = Plan::create([
            'name' => 'Two installments',
            'code' => 'STUDENT-NOTIFY-'.uniqid(),
            'price' => 10000,
            'installments' => 2,
            'unlock_map' => [
                ['stages' => [20, 50], 'bundles' => []],
                ['stages' => [75, 100], 'bundles' => []],
            ],
            'is_active' => true,
        ]);
        $order = Order::create([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'plan_id' => $plan->id,
            'base_price' => 10000,
            'discount_amount' => 0,
            'total' => 10000,
            'status' => 'partial',
        ]);

        return [$student, $order];
    }
}
