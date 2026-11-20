<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained()->cascadeOnDelete();
            $table->decimal('total', 10, 2);
            $table->enum('status', ['pending', 'partial', 'complete'])->default('pending');
            $table->timestamps();

            $table->index(['user_id', 'project_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
