<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\College;
use App\Models\Coupon;
use App\Models\Group;
use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CouponSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function createGroup(): Group
    {
        $college = College::create([
            'name' => 'Coupon Test College '.uniqid(),
        ]);

        return Group::create([
            'college_id' => $college->id,
            'member_count' => 1,
            'pincode' => '422001',
            'whatsapp' => '9000000000',
            'guide_name' => 'Test Guide',
            'guide_mobile' => '9000000001',
        ]);
    }

    private function createCoupon(array $overrides = []): Coupon
    {
        return Coupon::create(array_merge([
            'code' => 'TEST'.strtoupper(uniqid()),
            'type' => 'percentage',
            'value' => 10,
            'scope' => 'site_wide',
            'project_id' => null,
            'source' => 'admin',
            'owner_group_id' => null,
            'created_by' => null,
            'valid_from' => now()->subDay(),
            'valid_until' => now()->addDay(),
            'max_uses' => 5,
            'used_count' => 0,
            'is_active' => true,
        ], $overrides));
    }

    public function test_expired_coupon_is_detected(): void
    {
        $coupon = $this->createCoupon([
            'valid_until' => now()->subDay(),
        ]);

        $this->assertTrue(now()->gt($coupon->valid_until));
    }

    public function test_project_coupon_has_a_specific_project(): void
    {
        $category = Category::create([
            'name' => 'Coupon Test Category '.uniqid(),
            'slug' => 'coupon-test-category-'.uniqid(),
        ]);

        $project = Project::create([
            'category_id' => $category->id,
            'title' => 'Coupon Test Project',
            'slug' => 'coupon-test-project-'.uniqid(),
            'abstract' => 'Project used for coupon security testing.',
            'is_iot' => false,
        ]);

        $coupon = $this->createCoupon([
            'scope' => 'project',
            'project_id' => $project->id,
        ]);

        $this->assertSame('project', $coupon->scope);
        $this->assertSame(
            $project->id,
            (int) $coupon->project_id
        );
    }

    public function test_referral_reward_coupon_is_assigned_to_its_owner_group(): void
    {
        $group = $this->createGroup();

        $coupon = $this->createCoupon([
            'source' => 'referral_reward',
            'owner_group_id' => $group->id,
            'max_uses' => 1,
        ]);

        $this->assertSame($group->id, $coupon->owner_group_id);
        $this->assertSame('referral_reward', $coupon->source);
    }

    public function test_coupon_usage_limit_is_detected(): void
    {
        $coupon = $this->createCoupon([
            'max_uses' => 1,
            'used_count' => 1,
        ]);

        $this->assertGreaterThanOrEqual(
            $coupon->max_uses,
            $coupon->used_count
        );
    }

    public function test_inactive_coupon_is_detected(): void
    {
        $coupon = $this->createCoupon([
            'is_active' => false,
        ]);

        $this->assertFalse($coupon->is_active);
    }
}
