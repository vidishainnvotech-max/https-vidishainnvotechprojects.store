<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\College;
use App\Models\Group;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Project;
use App\Models\User;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class C1PlanEntitlementTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_c1_test_payment_grants_all_stages_and_selected_bundles(): void
    {
        $this->seed(PlanSeeder::class);

        $student = $this->createStudent();
        $project = $this->createProject();
        $plan = Plan::query()->where('code', 'C1')->firstOrFail();

        $this->assertSame([
            [
                'stages' => [20, 50, 75, 100],
                'bundles' => [
                    'black_book',
                    'report_1',
                    'report_2',
                    'complete_project_zip',
                ],
            ],
        ], $plan->unlock_map);

        $orderResponse = $this->actingAs($student, 'sanctum')
            ->postJson('/api/orders', [
                'project_id' => $project->id,
                'plan_id' => $plan->id,
            ])
            ->assertCreated()
            ->assertJsonPath('order.status', 'pending');

        $order = Order::query()->findOrFail($orderResponse->json('order.id'));

        $paymentResponse = $this->actingAs($student, 'sanctum')
            ->postJson("/api/orders/{$order->id}/payments")
            ->assertCreated()
            ->assertJsonPath('unlock_stages', [20, 50, 75, 100])
            ->assertJsonPath('unlock_bundles', [
                'black_book',
                'report_1',
                'report_2',
                'complete_project_zip',
            ]);

        $this->assertDatabaseCount('user_access', 0);
        $this->assertDatabaseCount('user_bundle_access', 0);

        $paymentId = $paymentResponse->json('payment.id');
        $this->assertNotNull($paymentId);

        $this->actingAs($student, 'sanctum')
            ->postJson(
                "/api/orders/{$order->id}/payments/{$paymentId}/test-success"
            )
            ->assertOk()
            ->assertJsonPath('order.status', 'complete')
            ->assertJsonPath('unlock_stages', [20, 50, 75, 100])
            ->assertJsonPath('unlock_bundles', [
                'black_book',
                'report_1',
                'report_2',
                'complete_project_zip',
            ]);

        $stageEntitlements = DB::table('user_access')
            ->where('user_id', $student->id)
            ->where('project_id', $project->id)
            ->orderBy('stage_percent')
            ->pluck('stage_percent')
            ->map(fn ($stagePercent): int => (int) $stagePercent)
            ->all();

        $bundleEntitlements = DB::table('user_bundle_access')
            ->where('user_id', $student->id)
            ->where('project_id', $project->id)
            ->orderBy('bundle')
            ->pluck('bundle')
            ->all();

        $this->assertSame([20, 50, 75, 100], $stageEntitlements);
        $this->assertSame([
            'black_book',
            'complete_project_zip',
            'report_1',
            'report_2',
        ], $bundleEntitlements);

        $this->assertDatabaseHas('user_access', [
            'user_id' => $student->id,
            'project_id' => $project->id,
            'stage_percent' => 20,
        ]);
        $this->assertDatabaseHas('user_access', [
            'user_id' => $student->id,
            'project_id' => $project->id,
            'stage_percent' => 75,
        ]);
        $this->assertDatabaseMissing('user_bundle_access', [
            'user_id' => $student->id,
            'project_id' => $project->id,
            'bundle' => 'semester_1_documents',
        ]);

        $this->assertDatabaseHas('orders', [
            'id' => $order->id,
            'status' => 'complete',
        ]);
        $this->assertDatabaseHas('payments', [
            'id' => $paymentId,
            'status' => 'success',
        ]);
    }

    private function createStudent(): User
    {
        $college = College::create([
            'name' => 'C1 Entitlement College',
        ]);

        $group = Group::create([
            'college_id' => $college->id,
            'member_count' => 1,
            'pincode' => '422001',
            'whatsapp' => '9000000010',
            'guide_name' => 'C1 Test Guide',
            'guide_mobile' => '9000000011',
        ]);

        return User::factory()->create([
            'mobile' => '9000000012',
            'college_id' => (string) $college->id,
            'group_id' => $group->id,
            'role' => 'student',
        ]);
    }

    private function createProject(): Project
    {
        $category = Category::create([
            'name' => 'C1 Entitlement Category',
            'slug' => 'c1-entitlement-category',
        ]);

        return Project::create([
            'category_id' => $category->id,
            'title' => 'C1 Entitlement Project',
            'slug' => 'c1-entitlement-project',
            'abstract' => 'Project used to verify C1 payment entitlements.',
            'is_iot' => false,
            'is_active' => true,
        ]);
    }
}
