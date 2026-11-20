
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One referral code belongs to one group.
        Schema::create('referral_codes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('group_id')
                ->unique()
                ->constrained('groups')
                ->cascadeOnDelete();

            $table->string('code', 32)->unique();
            $table->boolean('is_active')->default(true);

            $table->timestamps();
        });

        // Tracks which group referred another group.
        Schema::create('referral_uses', function (Blueprint $table) {
            $table->id();

            $table->foreignId('referral_code_id')
                ->constrained('referral_codes')
                ->restrictOnDelete();

            $table->foreignId('referrer_group_id')
                ->constrained('groups')
                ->restrictOnDelete();

            $table->foreignId('referred_group_id')
                ->unique()
                ->constrained('groups')
                ->restrictOnDelete();

            $table->foreignId('qualified_order_id')
                ->nullable()
                ->unique()
                ->constrained('orders')
                ->restrictOnDelete();

            $table->enum('status', ['pending', 'qualified'])
                ->default('pending');

            $table->timestamp('qualified_at')->nullable();

            $table->timestamps();
        });

        // Admin promotional coupons and referral reward coupons.
        Schema::create('coupons', function (Blueprint $table) {
            $table->id();

            $table->string('code', 50)->unique();

            $table->enum('type', ['percentage', 'fixed']);
            $table->decimal('value', 10, 2);

            $table->enum('scope', ['site_wide', 'project']);
            $table->foreignId('project_id')
                ->nullable()
                ->constrained('projects')
                ->restrictOnDelete();

            $table->enum('source', ['admin', 'referral_reward'])
                ->default('admin');

            $table->foreignId('owner_group_id')
                ->nullable()
                ->constrained('groups')
                ->restrictOnDelete();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('valid_from')->nullable();
            $table->timestamp('valid_until')->nullable();

            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('used_count')->default(0);

            $table->boolean('is_active')->default(true);

            $table->timestamps();
        });

        // One coupon maximum per order.
        Schema::create('coupon_redemptions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('coupon_id')
                ->constrained('coupons')
                ->restrictOnDelete();

            $table->foreignId('order_id')
                ->unique()
                ->constrained('orders')
                ->restrictOnDelete();

            $table->decimal('discount_amount', 10, 2);
            $table->timestamp('redeemed_at')->nullable();

            $table->enum('status', ['pending', 'redeemed'])
                ->default('pending');

            $table->timestamps();
        });

        // Store the applied coupon and discount on each order.
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('coupon_id')
                ->nullable()
                ->constrained('coupons')
                ->restrictOnDelete();

            $table->decimal('discount_amount', 10, 2)
                ->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('coupon_id');
            $table->dropColumn('discount_amount');
        });

        Schema::dropIfExists('coupon_redemptions');
        Schema::dropIfExists('referral_uses');
        Schema::dropIfExists('referral_codes');
        Schema::dropIfExists('coupons');
    }
};
