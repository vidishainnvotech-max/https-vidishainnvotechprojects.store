<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Group;
use App\Models\ReferralCode;
use App\Models\ReferralUse;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReferralRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private College $college;

    private Group $referrerGroup;

    protected function setUp(): void
    {
        parent::setUp();

        $this->college = College::create([
            'name' => 'Referral Test College',
        ]);

        $this->referrerGroup = $this->createGroup(
            'Referrer Group'
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

    private function createReferralCode(
        Group $group,
        bool $active = true
    ): ReferralCode {
        return ReferralCode::create([
            'group_id' => $group->id,
            'code' => 'REF'.strtoupper(Str::random(8)),
            'is_active' => $active,
        ]);
    }

    private function registrationPayload(
        ?string $referralCode = null
    ): array {
        $token = Str::lower(Str::random(8));

        $payload = [
            'college_id' => $this->college->id,
            'group_name' => 'Registration Group '.$token,
            'guide_name' => 'Test Guide',
            'guide_mobile' => '9'.random_int(100000000, 999999999),
            'pincode' => '422001',
            'whatsapp' => '8'.random_int(100000000, 999999999),
            'members' => [
                [
                    'name' => 'Test Leader',
                    'email' => $token.'@example.com',
                    'student_id' => 'STU'.strtoupper(Str::random(8)),
                    'mobile' => '7'.random_int(100000000, 999999999),
                    'is_leader' => true,
                ],
            ],
            'password' => 'Password@123',
            'password_confirmation' => 'Password@123',
        ];

        if ($referralCode !== null) {
            $payload['referral_code'] = $referralCode;
        }

        return $payload;
    }

    public function test_valid_referral_code_attributes_new_group(): void
    {
        $code = $this->createReferralCode($this->referrerGroup);

        $response = $this->postJson(
            '/api/register',
            $this->registrationPayload($code->code)
        );

        $response->assertSuccessful();

        $referredGroup = Group::where(
            'college_id',
            $this->college->id
        )
            ->where('guide_name', 'Test Guide')
            ->latest('id')
            ->first();

        $this->assertNotNull($referredGroup);
        $this->assertNotEquals(
            $this->referrerGroup->id,
            $referredGroup->id
        );

        $this->assertDatabaseHas('referral_uses', [
            'referrer_group_id' => $this->referrerGroup->id,
            'referred_group_id' => $referredGroup->id,
            'status' => 'pending',
        ]);
    }

    public function test_registration_without_referral_code_still_works(): void
    {
        $response = $this->postJson(
            '/api/register',
            $this->registrationPayload()
        );

        $response->assertSuccessful();

        $this->assertDatabaseCount('referral_uses', 0);
    }

    public function test_invalid_referral_code_is_rejected(): void
    {
        $response = $this->postJson(
            '/api/register',
            $this->registrationPayload('INVALID-CODE')
        );

        $response->assertStatus(422);
    }

    public function test_inactive_referral_code_is_rejected(): void
    {
        $code = $this->createReferralCode(
            $this->referrerGroup,
            false
        );

        $response = $this->postJson(
            '/api/register',
            $this->registrationPayload($code->code)
        );

        $response->assertStatus(422);

        $this->assertDatabaseCount('referral_uses', 0);
    }

    public function test_registration_cannot_change_existing_referral_attribution(): void
    {
        $firstCode = $this->createReferralCode($this->referrerGroup);

        $secondGroup = $this->createGroup('Second Referrer');
        $secondCode = $this->createReferralCode($secondGroup);

        $referredGroup = $this->createGroup('Already Referred');

        ReferralUse::create([
            'referral_code_id' => $firstCode->id,
            'referrer_group_id' => $this->referrerGroup->id,
            'referred_group_id' => $referredGroup->id,
            'status' => 'pending',
            'qualified_order_id' => null,
            'qualified_at' => null,
        ]);

        // The database must not permit a second attribution
        // for the same referred group.
        $this->expectException(
            QueryException::class
        );

        ReferralUse::create([
            'referral_code_id' => $secondCode->id,
            'referrer_group_id' => $secondGroup->id,
            'referred_group_id' => $referredGroup->id,
            'status' => 'pending',
            'qualified_order_id' => null,
            'qualified_at' => null,
        ]);
    }

    public function test_self_referral_is_not_accepted_during_registration(): void
    {
        $code = $this->createReferralCode($this->referrerGroup);

        $payload = $this->registrationPayload($code->code);

        // Attempt to override backend attribution using a group ID.
        $payload['referrer_group_id'] = $this->referrerGroup->id;

        $response = $this->postJson('/api/register', $payload);

        $response->assertSuccessful();

        $referredGroup = Group::where(
            'guide_name',
            'Test Guide'
        )->latest('id')->first();

        $this->assertNotNull($referredGroup);

        $this->assertDatabaseHas('referral_uses', [
            'referrer_group_id' => $this->referrerGroup->id,
            'referred_group_id' => $referredGroup->id,
            'status' => 'pending',
        ]);
    }
}
