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

class ShipmentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_iot_order_automatically_creates_one_pending_shipment(): void
    {
        $student = $this->student();
        $project = $this->project(true);
        $plan = $this->plan();

        $response = $this->actingAs($student, 'sanctum')
            ->postJson('/api/orders', [
                'project_id' => $project->id,
                'plan_id' => $plan->id,
                'shipment' => $this->delivery(),
            ]);

        $response->assertCreated()
            ->assertJsonPath('order.shipment.status', 'pending')
            ->assertJsonPath('order.shipment.quantity', 2)
            ->assertJsonPath('order.shipment.recipient_name', 'Asha Patil')
            ->assertJsonCount(1, 'order.shipment.events');

        $orderId = $response->json('order.id');
        $this->assertDatabaseHas('iot_shipments', [
            'order_id' => $orderId,
            'project_id' => $project->id,
            'user_id' => $student->id,
            'status' => 'pending',
            'quantity' => 2,
        ]);
        $this->assertDatabaseCount('iot_shipments', 1);
        $this->assertDatabaseHas('iot_shipment_events', [
            'status' => 'pending',
            'title' => 'Shipment created',
        ]);
    }

    public function test_iot_order_requires_complete_delivery_details(): void
    {
        $student = $this->student();

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/orders', [
                'project_id' => $this->project(true)->id,
                'plan_id' => $this->plan()->id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'shipment.recipient_name',
                'shipment.shipping_address',
                'shipment.quantity',
            ]);

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('iot_shipments', 0);
    }

    public function test_digital_order_never_creates_a_shipment(): void
    {
        $student = $this->student();

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/orders', [
                'project_id' => $this->project(false)->id,
                'plan_id' => $this->plan()->id,
            ])
            ->assertCreated()
            ->assertJsonPath('order.shipment', null);

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('iot_shipments', 0);
    }

    public function test_physical_iot_mini_project_can_be_purchased_with_a_shipment(): void
    {
        $student = $this->student();
        $project = $this->project(true, 'diploma_mini');

        $response = $this->actingAs($student, 'sanctum')
            ->postJson('/api/orders', [
                'project_id' => $project->id,
                'shipment' => $this->delivery(),
            ])
            ->assertCreated()
            ->assertJsonPath('order.plan_id', null)
            ->assertJsonPath('order.shipment.status', 'pending');

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/orders/'.$response->json('order.id').'/next-payment')
            ->assertOk()
            ->assertJsonPath('amount', '5000.00')
            ->assertJsonPath('total_installments', 1);

        $this->assertDatabaseHas('iot_shipments', [
            'project_id' => $project->id,
            'status' => 'pending',
        ]);
    }

    public function test_pickup_order_does_not_require_a_delivery_address(): void
    {
        $student = $this->student();
        $project = $this->project(true);

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/orders', [
                'project_id' => $project->id,
                'plan_id' => $this->plan()->id,
                'shipment' => [
                    'delivery_method' => 'pickup',
                    'recipient_name' => 'Asha Patil',
                    'recipient_phone' => '9876543210',
                    'quantity' => 1,
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('order.shipment.delivery_method', 'pickup')
            ->assertJsonPath(
                'order.shipment.shipping_address',
                'Vidisha InnoVTech office pickup'
            );

        $this->assertDatabaseHas('iot_shipments', [
            'project_id' => $project->id,
            'delivery_method' => 'pickup',
            'status' => 'pending',
        ]);
    }

    public function test_iot_mini_pickup_returns_the_one_time_payment(): void
    {
        $student = $this->student();
        $project = $this->project(true, 'diploma_mini');

        $orderResponse = $this->actingAs($student, 'sanctum')
            ->postJson('/api/orders', [
                'project_id' => $project->id,
                'shipment' => [
                    'delivery_method' => 'pickup',
                    'recipient_name' => 'Asha Patil',
                    'recipient_phone' => '9876543210',
                    'quantity' => 1,
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('order.shipment.delivery_method', 'pickup');

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/orders/'.$orderResponse->json('order.id').'/next-payment')
            ->assertOk()
            ->assertJsonPath('amount', '5000.00')
            ->assertJsonPath('installment_no', 1)
            ->assertJsonPath('total_installments', 1);
    }

    public function test_shipment_service_is_idempotent_for_an_order(): void
    {
        $student = $this->student();
        $project = $this->project(true);
        $order = Order::create([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'plan_id' => $this->plan()->id,
            'base_price' => 12000,
            'discount_amount' => 0,
            'total' => 12000,
            'status' => 'pending',
        ]);

        $service = app(ShipmentService::class);
        $first = $service->createForOrder($order, $this->delivery());
        $second = $service->createForOrder($order, $this->delivery());

        $this->assertTrue($first->is($second));
        $this->assertDatabaseCount('iot_shipments', 1);
        $this->assertDatabaseCount('iot_shipment_events', 1);
    }

    private function student(): User
    {
        $college = College::create(['name' => 'Shipment Test College']);

        return User::factory()->create([
            'mobile' => '9000012345',
            'college_id' => $college->id,
            'role' => 'student',
        ]);
    }

    private function project(bool $isIot, string $projectType = 'standard'): Project
    {
        $category = Category::create([
            'name' => $isIot ? 'IoT Projects' : 'Digital Projects',
            'slug' => ($isIot ? 'iot' : 'digital').'-'.uniqid(),
        ]);

        return Project::create([
            'category_id' => $category->id,
            'title' => $isIot ? 'Smart Irrigation Kit' : 'Expense Tracker',
            'slug' => ($isIot ? 'smart-irrigation' : 'expense-tracker').'-'.uniqid(),
            'abstract' => 'Shipment workflow test project.',
            'is_iot' => $isIot,
            'kit_price' => null,
            'project_type' => $projectType,
            'offer_price' => $projectType === 'diploma_mini' ? 5000 : null,
            'is_active' => true,
        ]);
    }

    private function plan(): Plan
    {
        return Plan::create([
            'name' => 'Complete Plan',
            'code' => 'C1-'.uniqid(),
            'price' => 12000,
            'installments' => 1,
            'unlock_map' => [['stages' => [20, 50, 75, 100], 'bundles' => []]],
            'is_active' => true,
        ]);
    }

    private function delivery(): array
    {
        return [
            'delivery_method' => 'delivery',
            'recipient_name' => 'Asha Patil',
            'recipient_phone' => '9876543210',
            'shipping_address' => '12 College Road',
            'city' => 'Nashik',
            'state' => 'Maharashtra',
            'postal_code' => '422001',
            'country' => 'India',
            'quantity' => 2,
        ];
    }
}
