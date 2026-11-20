<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['plan_id']);
            $table->unsignedBigInteger('plan_id')->nullable()->change();
            $table->foreign('plan_id')
                ->references('id')
                ->on('plans')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && DB::table('orders')->whereNull('plan_id')->exists()) {
            throw new RuntimeException('Cannot rollback: mini-project orders exist with a null plan_id.');
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['plan_id']);
            $table->unsignedBigInteger('plan_id')->nullable(false)->change();
            $table->foreign('plan_id')
                ->references('id')
                ->on('plans')
                ->cascadeOnDelete();
        });
    }
};
