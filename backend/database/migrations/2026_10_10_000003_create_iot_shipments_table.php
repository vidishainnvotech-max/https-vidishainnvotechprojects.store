<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('iot_shipments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();

            $table->decimal('kit_price', 10, 2);

            $table->string('recipient_name', 150);
            $table->string('recipient_phone', 20);
            $table->text('shipping_address');
            $table->string('city', 100);
            $table->string('state', 100);
            $table->string('postal_code', 20);
            $table->string('country', 100)->default('India');

            $table->string('status', 30)->default('requested');
            $table->string('tracking_number', 150)->nullable();
            $table->string('courier_name', 100)->nullable();

            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('delivered_at')->nullable();

            $table->timestamps();

            $table->unique('order_id', 'iot_shipments_order_unique');
            $table->index(['user_id', 'project_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('iot_shipments');
    }
};
