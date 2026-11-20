<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\College;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Project;
use App\Models\User;
use App\Services\ShipmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentOrderTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_view_own_order_with_shipment_history(): void
    {
        [$student, $order] = $this->iotOrder();
        $shipment = app(ShipmentService::class)->createForOrder($order, $this->delivery());
        $shipment->events()->create([
            'status' => 'packed',
            'title' => 'Shipment packed',
            'occurred_at' => now()->addHour(),
        ]);

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/student/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $order->id)
            ->assertJsonPath('data.shipment.shipment_number', $shipment->shipment_number)
            ->assertJsonPath('data.shipment.recipient_name', 'Asha Patil')
            ->assertJsonCount(2, 'data.shipment.events')
            ->assertJsonPath('data.shipment.events.1.status', 'packed');

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/student/orders')
            ->assertOk()
            ->assertJsonPath('data.data.0.id', $order->id)
            ->assertJsonPath('data.data.0.shipment.status', 'pending');
    }

    public function test_student_cannot_view_another_students_order(): void
    {
        [, $order] = $this->iotOrder();
        $otherCollege = College::create(['name' => 'Other College']);
        $otherStudent = User::factory()->create([
            'mobile' => '9000099999',
            'college_id' => $otherCollege->id,
            'role' => 'student',
        ]);

        $this->actingAs($otherStudent, 'sanctum')
            ->getJson("/api/student/orders/{$order->id}")
            ->assertNotFound();
    }

    public function test_digital_order_is_returned_without_shipment(): void
    {
        [$student, $order] = $this->iotOrder(false);

        $this->actingAs($student, 'sanctum')
            ->getJson("/api/student/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.shipment', null);
    }

    private function iotOrder(bool $isIot = true): array
    {
        $college = College::create(['name' => 'Tracking Test College']);
        $student = User::factory()->create([
            'mobile' => '9000055555',
            'college_id' => $college->id,
            'role' => 'student',
        ]);
        $category = Category::create([
            'name' => 'Tracking Category',
            'slug' => 'tracking-category-'.uniqid(),
        ]);
        $project = Project::create([
            'category_id' => $category->id,
            'title' => 'Tracking Project',
            'slug' => 'tracking-project-'.uniqid(),
            'is_iot' => $isIot,
            'kit_price' => $isIot ? 2500 : null,
            'project_type' => 'standard',
            'is_active' => true,
        ]);
        $plan = Plan::create([
            'name' => 'Tracking Plan',
            'code' => 'TRACK-'.uniqid(),
            'price' => 10000,
            'installments' => 1,
            'unlock_map' => [['stages' => [100], 'bundles' => []]],
            'is_active' => true,
        ]);
        $order = Order::create([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'plan_id' => $plan->id,
            'base_price' => 10000,
            'discount_amount' => 0,
            'total' => 10000,
            'status' => 'pending',
        ]);

        return [$student, $order];
    }

    private function delivery(): array
    {
        return [
            'recipient_name' => 'Asha Patil',
            'recipient_phone' => '9876543210',
            'shipping_address' => '12 College Road',
            'city' => 'Nashik',
            'state' => 'Maharashtra',
            'postal_code' => '422001',
            'country' => 'India',
            'quantity' => 1,
        ];
    }
}
