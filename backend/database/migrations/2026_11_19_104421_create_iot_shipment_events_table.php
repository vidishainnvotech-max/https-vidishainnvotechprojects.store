<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('iot_shipment_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('iot_shipment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30);
            $table->string('title', 150);
            $table->text('description')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['iot_shipment_id', 'occurred_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('iot_shipment_events');
    }
};
