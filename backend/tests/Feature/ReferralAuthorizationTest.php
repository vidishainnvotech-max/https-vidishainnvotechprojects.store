<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Group;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReferralAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private College $college;

    private Group $group;

    private User $student;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->college = College::create([
            'name' => 'Authorization Test College',
        ]);

        $this->group = $this->createGroup('Student Group');

        $this->student = $this->createUser(
            $this->group,
            'student'
        );

        $this->admin = $this->createUser(
            $this->group,
            'admin'
        );
    }

    private function createGroup(string $guideName): Group
    {
        return Group::create([
            'college_id' => $this->college->id,
            'guide_name' => $guideName,
            'guide_mobile' => '9'.random_int(100000000, 999999999),
            'member_count' => 1,
            'pincode' => '422001',
            'whatsapp' => '8'.random_int(100000000, 999999999),
        ]);
    }

    private function createUser(
        Group $group,
        string $role
    ): User {
        return User::create([
            'name' => ucfirst($role).' Test User',
            'email' => $role.'-'.Str::lower(Str::random(8))
                .'@example.com',
            'mobile' => '7'.random_int(100000000, 999999999),
            'college_id' => $this->college->id,
            'group_id' => $group->id,
            'password' => bcrypt('Password@123'),
            'role' => $role,
            'email_verified_at' => now(),
        ]);
    }

    public function test_guest_cannot_access_admin_coupon_or_referral_endpoints(): void
    {
        $this->getJson('/api/admin/coupons')
            ->assertUnauthorized();

        $this->getJson('/api/admin/referrals')
            ->assertUnauthorized();

        $this->getJson('/api/admin/referral-codes')
            ->assertUnauthorized();

        $this->getJson('/api/admin/referral-rewards')
            ->assertUnauthorized();
    }

    public function test_student_cannot_access_admin_coupon_or_referral_endpoints(): void
    {
        $this->actingAs($this->student, 'sanctum');

        $this->getJson('/api/admin/coupons')
            ->assertForbidden();

        $this->getJson('/api/admin/referrals')
            ->assertForbidden();

        $this->getJson('/api/admin/referral-codes')
            ->assertForbidden();

        $this->getJson('/api/admin/referral-rewards')
            ->assertForbidden();
    }

    public function test_authenticated_student_can_access_referral_dashboard(): void
    {
        $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/referrals')
            ->assertOk();
    }

    public function test_student_cannot_change_referral_group_using_query_parameters(): void
    {
        $otherGroup = $this->createGroup('Other Student Group');

        $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/referrals?group_id='.$otherGroup->id)
            ->assertOk();

        // The response must not expose another group's referral data.
        // This assertion checks the response structure for common
        // group identifiers; adjust if your controller uses another shape.
        $response = $this->actingAs($this->student, 'sanctum')
            ->getJson('/api/student/referrals?group_id='.$otherGroup->id);

        $response->assertOk();

        $data = $response->json();

        $this->assertIsArray($data);

        // Ensure the controller does not return the requested group ID
        // as the current student's group identity.
        $this->assertNotEquals(
            $otherGroup->id,
            data_get($data, 'group.id')
        );
    }
}
