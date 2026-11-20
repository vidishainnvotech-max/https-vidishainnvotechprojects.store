<?php

namespace Tests\Feature;

use App\Mail\ShipmentStatusUpdated;
use App\Models\Category;
use App\Models\College;
use App\Models\IotShipment;
use App\Models\Order;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminIotShipmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_search_and_filter_shipments(): void
    {
        [$admin, $student, $project] = $this->fixtures();
        $this->shipment($student, $project, 'pending');
        $this->shipment($student, $project, 'delivered', 'DTDC');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/iot-shipments?status=delivered&courier=DTDC&order_status=pending&search=IoT')
            ->assertOk()
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.status', 'delivered')
            ->assertJsonPath('data.data.0.order.status', 'pending');
    }

    public function test_admin_can_move_shipment_through_packing_and_shipping(): void
    {
        Mail::fake();
        [$admin, $student, $project] = $this->fixtures();
        $shipment = $this->shipment($student, $project, 'pending');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", [
                'status' => 'packed',
                'delivery_remarks' => 'Quality check complete.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'packed');

        $response = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", [
                'status' => 'shipped',
                'courier_name' => 'Blue Dart',
                'tracking_number' => 'BD123456789',
                'tracking_url' => 'https://www.bluedart.com/tracking/BD123456789',
                'estimated_delivery_date' => now()->addDays(4)->toDateString(),
                'delivery_remarks' => 'Handed to delivery partner.',
            ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'shipped')
            ->assertJsonPath('data.courier_name', 'Blue Dart')
            ->assertJsonPath('data.tracking_number', 'BD123456789');
        $this->assertNotNull($response->json('data.dispatched_at'));
        $this->assertDatabaseHas('iot_shipment_events', [
            'iot_shipment_id' => $shipment->id,
            'status' => 'shipped',
            'updated_by' => $admin->id,
        ]);
        Mail::assertSent(
            ShipmentStatusUpdated::class,
            fn (ShipmentStatusUpdated $mail): bool => $mail->shipment->is($shipment)
                && $mail->shipment->tracking_number === 'BD123456789'
        );
    }

    public function test_shipping_requires_delivery_partner_and_awb(): void
    {
        [$admin, $student, $project] = $this->fixtures();
        $shipment = $this->shipment($student, $project, 'packed');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", ['status' => 'shipped'])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('iot_shipments', ['id' => $shipment->id, 'status' => 'packed']);
    }

    public function test_invalid_status_transition_is_rejected(): void
    {
        [$admin, $student, $project] = $this->fixtures();
        $shipment = $this->shipment($student, $project, 'pending');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", [
                'status' => 'delivered',
                'courier_name' => 'DTDC',
                'tracking_number' => 'D123',
            ])
            ->assertUnprocessable();
    }

    public function test_admin_can_update_tracking_details_without_changing_status(): void
    {
        [$admin, $student, $project] = $this->fixtures();
        $shipment = $this->shipment($student, $project, 'pending');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", [
                'status' => 'pending',
                'courier_name' => 'India Post',
                'estimated_delivery_date' => now()->addWeek()->toDateString(),
                'delivery_remarks' => 'Partner assigned before packing.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.courier_name', 'India Post');

        $this->assertDatabaseHas('iot_shipment_events', [
            'iot_shipment_id' => $shipment->id,
            'title' => 'Shipment details updated',
        ]);
    }

    public function test_pickup_can_move_from_packed_to_delivered_without_courier_details(): void
    {
        [$admin, $student, $project] = $this->fixtures();
        $shipment = $this->shipment(
            $student,
            $project,
            'packed',
            null,
            'pickup'
        );

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", [
                'status' => 'delivered',
                'delivery_remarks' => 'Kit collected from the office.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'delivered')
            ->assertJsonPath('data.delivery_method', 'pickup');

        $this->assertDatabaseHas('iot_shipments', [
            'id' => $shipment->id,
            'delivery_method' => 'pickup',
            'status' => 'delivered',
        ]);
    }

    public function test_pickup_ready_status_sends_customer_email(): void
    {
        Mail::fake();
        [$admin, $student, $project] = $this->fixtures();
        $shipment = $this->shipment(
            $student,
            $project,
            'pending',
            null,
            'pickup'
        );

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", [
                'status' => 'packed',
                'delivery_remarks' => 'Bring your college identity card.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'packed');

        Mail::assertSent(
            ShipmentStatusUpdated::class,
            fn (ShipmentStatusUpdated $mail): bool => $mail->shipment->is($shipment)
                && $mail->shipment->delivery_method === 'pickup'
        );
    }

    public function test_updating_shipped_delivery_details_sends_customer_email(): void
    {
        Mail::fake();
        [$admin, $student, $project] = $this->fixtures();
        $shipment = $this->shipment($student, $project, 'shipped');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", [
                'status' => 'shipped',
                'courier_name' => 'Delhivery',
                'tracking_number' => 'TRACK123',
                'delivery_remarks' => 'Delivery details updated.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'shipped');

        Mail::assertSent(
            ShipmentStatusUpdated::class,
            fn (ShipmentStatusUpdated $mail): bool => $mail->shipment->is($shipment)
                && $mail->shipment->delivery_remarks === 'Delivery details updated.'
        );
    }

    public function test_updating_ready_pickup_details_sends_customer_email(): void
    {
        Mail::fake();
        [$admin, $student, $project] = $this->fixtures();
        $shipment = $this->shipment($student, $project, 'packed', null, 'pickup');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", [
                'status' => 'packed',
                'estimated_delivery_date' => now()->addDay()->toDateString(),
                'delivery_remarks' => 'Pickup instructions updated.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'packed');

        Mail::assertSent(
            ShipmentStatusUpdated::class,
            fn (ShipmentStatusUpdated $mail): bool => $mail->shipment->is($shipment)
                && $mail->shipment->delivery_method === 'pickup'
                && $mail->shipment->delivery_remarks === 'Pickup instructions updated.'
        );
    }

    public function test_student_cannot_access_admin_shipment_endpoints(): void
    {
        [, $student, $project] = $this->fixtures();
        $shipment = $this->shipment($student, $project, 'pending');

        $this->actingAs($student, 'sanctum')->getJson('/api/admin/iot-shipments')->assertForbidden();
        $this->actingAs($student, 'sanctum')
            ->patchJson("/api/admin/iot-shipments/{$shipment->id}", ['status' => 'packed'])
            ->assertForbidden();
    }

    private function fixtures(): array
    {
        $college = College::create(['name' => 'Admin Shipment College']);
        $admin = User::factory()->create([
            'mobile' => '9000000001', 'college_id' => $college->id, 'role' => 'admin',
        ]);
        $student = User::factory()->create([
            'mobile' => '9000000002', 'college_id' => $college->id, 'role' => 'student',
        ]);
        $category = Category::create(['name' => 'IoT', 'slug' => 'iot-'.uniqid()]);
        $project = Project::create([
            'category_id' => $category->id,
            'title' => 'IoT Test Project',
            'slug' => 'iot-test-project-'.uniqid(),
            'is_iot' => true,
            'kit_price' => 1500,
            'project_type' => 'standard',
            'is_active' => true,
        ]);

        return [$admin, $student, $project];
    }

    private function shipment(
        User $student,
        Project $project,
        string $status,
        ?string $courier = null,
        string $deliveryMethod = 'delivery'
    ): IotShipment {
        $order = Order::create([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'plan_id' => null,
            'base_price' => 1500,
            'discount_amount' => 0,
            'total' => 1500,
            'status' => 'pending',
        ]);

        return IotShipment::create([
            'shipment_number' => 'SHP-'.Str::upper((string) Str::ulid()),
            'user_id' => $student->id,
            'project_id' => $project->id,
            'order_id' => $order->id,
            'kit_price' => 1500,
            'quantity' => 1,
            'delivery_method' => $deliveryMethod,
            'recipient_name' => 'Test Recipient',
            'recipient_phone' => '9876500000',
            'shipping_address' => '123 Test Street',
            'city' => 'Mumbai',
            'state' => 'Maharashtra',
            'postal_code' => '400001',
            'country' => 'India',
            'status' => $status,
            'courier_name' => $courier ?? (in_array($status, ['shipped', 'in_transit', 'out_for_delivery', 'delivered'], true) ? 'DTDC' : null),
            'tracking_number' => in_array($status, ['shipped', 'in_transit', 'out_for_delivery', 'delivered'], true) ? 'TRACK123' : null,
            'dispatched_at' => in_array($status, ['shipped', 'in_transit', 'out_for_delivery', 'delivered'], true) ? now() : null,
            'delivered_at' => $status === 'delivered' ? now() : null,
        ]);
    }
}
