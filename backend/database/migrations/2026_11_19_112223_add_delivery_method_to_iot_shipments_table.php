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
        Schema::table('iot_shipments', function (Blueprint $table) {
            $table->string('delivery_method', 20)
                ->default('delivery')
                ->after('quantity');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('iot_shipments', function (Blueprint $table) {
            $table->dropColumn('delivery_method');
        });
    }
};
