<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\College;
use App\Models\Order;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminOrderPricingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_orders_api_returns_price_snapshot_fields(): void
    {
        $college = College::create([
            'name' => 'Pricing Test College',
        ]);

        $admin = User::factory()->create([
            'mobile' => '9876543210',
            'college_id' => $college->id,
            'role' => 'admin',
        ]);

        $student = User::factory()->create([
            'mobile' => '9876543211',
            'college_id' => $college->id,
            'role' => 'student',
        ]);

        $category = Category::create([
            'name' => 'Pricing Test Category',
            'slug' => 'pricing-test-category',
        ]);

        $project = Project::create([
            'category_id' => $category->id,
            'title' => 'Pricing Test Project',
            'slug' => 'pricing-test-project',
            'abstract' => 'Project for order pricing tests.',
            'is_iot' => false,
        ]);

        $order = Order::create([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'plan_id' => null,
            'base_price' => 15000,
            'discount_amount' => 1500,
            'total' => 13500,
            'status' => 'pending',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/admin/orders')
            ->assertOk()
            ->assertJsonPath('data.data.0.base_price', '15000.00')
            ->assertJsonPath('data.data.0.discount_amount', '1500.00')
            ->assertJsonPath('data.data.0.total', '13500.00');
    }
}
