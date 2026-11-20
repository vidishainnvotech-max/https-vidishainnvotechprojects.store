<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\College;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderInvoiceDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_download_own_invoice_but_not_another_students_invoice(): void
    {
        [$student, $order] = $this->order();
        $otherStudent = User::factory()->create([
            'college_id' => $student->college_id,
            'mobile' => '9000000999',
            'role' => 'student',
        ]);

        $response = $this->actingAs($student, 'sanctum')
            ->get("/api/student/orders/{$order->id}/invoice");

        $response->assertOk()
            ->assertHeader('content-type', 'application/pdf')
            ->assertHeader('content-disposition', 'attachment; filename="invoice-order-'.$order->id.'.pdf"');

        $this->assertStringStartsWith('%PDF-1.4', $response->getContent());

        $this->actingAs($otherStudent, 'sanctum')
            ->get("/api/student/orders/{$order->id}/invoice")
            ->assertNotFound();
    }

    public function test_admin_can_download_any_order_invoice(): void
    {
        [$student, $order] = $this->order();
        $admin = User::factory()->create([
            'college_id' => $student->college_id,
            'mobile' => '9000000888',
            'role' => 'admin',
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->get("/api/admin/orders/{$order->id}/invoice");

        $response->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->assertStringContainsString('PAYMENT HISTORY', $response->getContent());
    }

    private function order(): array
    {
        $college = College::create(['name' => 'Invoice Test College']);
        $student = User::factory()->create([
            'college_id' => $college->id,
            'mobile' => '9000000777',
            'role' => 'student',
        ]);
        $category = Category::create([
            'name' => 'Invoice Category',
            'slug' => 'invoice-category',
        ]);
        $project = Project::create([
            'category_id' => $category->id,
            'title' => 'Invoice Test Project',
            'slug' => 'invoice-test-project',
            'is_iot' => false,
            'project_type' => 'standard',
            'is_active' => true,
        ]);
        $order = Order::create([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'plan_id' => null,
            'base_price' => 5000,
            'discount_amount' => 500,
            'total' => 4500,
            'status' => 'complete',
        ]);

        Payment::create([
            'order_id' => $order->id,
            'installment_no' => 1,
            'amount' => 4500,
            'status' => 'success',
            'paid_at' => now(),
        ]);

        return [$student, $order];
    }
}
